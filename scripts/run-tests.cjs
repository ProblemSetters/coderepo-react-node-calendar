// Run Tests: runs each suite, one Run Tests at a time, and writes each suite's scored results file
// from this run only. A candidate's own test runs never take the lock or write a scored file.
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const ROOT = path.resolve(__dirname, "..");
const LOCK_FILE = path.join(ROOT, ".cache/test-run.lock");
const TAKEOVER_FILE = `${LOCK_FILE}.takeover`;
// Each suite reports into this run's own file here. They move to the scored paths at the end.
const RUNS_DIR = path.join(ROOT, ".cache/test-runs");
const RUN_FILE_PATTERN = /^run-\d+-[\w-]+\.xml$/;
// One entry per suite, each with the scored file hackerrank.yml lists for it. `env` points the
// suite's reporter at this run's own file. TEST_RUN=scoring gives Run Tests' backend tests their
// own Mongo database, <db>_test_scoring (see backend/__tests__/support/environment.js).
const SUITES = [
    {
        name: "Backend",
        cwd: "backend",
        command: () => ["bun", "run", "test"],
        env: (runFile) => ({
            TEST_RUN: "scoring",
            JEST_JUNIT_OUTPUT_DIR: path.dirname(runFile),
            JEST_JUNIT_OUTPUT_NAME: path.basename(runFile),
        }),
        scoredFile: "output/backend.xml",
    },
    {
        name: "Frontend",
        cwd: "frontend",
        command: () => ["bun", "run", "test"],
        env: (runFile) => ({ VITEST_JUNIT_FILE: runFile }),
        scoredFile: "output/frontend.xml",
    },
];
// Uploaded with a ticket's hidden tests, never part of the starter: every testcase that ticket's
// solution reports, per scored file. A hidden test file that fails to load on a candidate's code
// reports nothing, so HackerRank would never store or grade its tests. Each expected testcase this
// run didn't report is added to its scored file as a failed one.
const EXPECTED_FILE = path.join(ROOT, "scoring/expected-testcases.json");
const RECORD_EXPECTED_FLAG = "--record-expected";
const DID_NOT_RUN_MESSAGE = "did not run: its test file failed to load or compile on this code";
const ENDED_EARLY_MESSAGE =
    "ended early and wrote no results: a test or the code it runs ended the process, or the tests could not start";
const EMPTY_REPORT = '<?xml version="1.0" encoding="UTF-8"?>\n<testsuites>\n</testsuites>\n';
const XML_ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" };
const LOCK_POLL_MS = 1000;
// One limit for the whole Run Tests, time spent waiting for another run included.
const RUN_LIMIT_MS = 300_000;
const KILL_GRACE_MS = 10_000;
const GROUP_POLL_MS = 100;
const WATCHDOG_POLL_MS = 1000;
const WATCHDOG_FLAG = "--watchdog";
const FAILED_EXIT_CODE = 1;
const INTERRUPTED_EXIT_CODE = 130;

let activeSuite = null;
let isLockHeld = false;
let isInterrupted = false;
const isRecording = process.argv.includes(RECORD_EXPECTED_FLAG);
// With RECORD_EXPECTED_FLAG: the ticket's hidden test files, as paths from the repository root.
const recordedTestFiles = isRecording
    ? process.argv.slice(process.argv.indexOf(RECORD_EXPECTED_FLAG) + 1)
    : [];
const runDeadline = Date.now() + RUN_LIMIT_MS;

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function pidAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (err) {
        return err.code === "EPERM";
    }
}

function stopGroup(groupId, signal) {
    try {
        process.kill(-groupId, signal);
    } catch (err) {
        if (err.code !== "ESRCH") throw err;
    }
}

// The owner can free the lock between our failed create and this read. null means "try again".
function readLockOwner() {
    try {
        return fs.readFileSync(LOCK_FILE, "utf8").split(" ").map(Number);
    } catch (err) {
        if (err.code === "ENOENT") return null;
        throw err;
    }
}

// Only one waiting run at a time may clear a dead run's lock. Without this, two waiting runs can
// both clear it, and the second one deletes the lock the first one has just taken. Returns false
// when this run should wait and look again.
function clearDeadLock(deadPid, suiteGroup) {
    if (!tryTakeTakeover()) return false;
    try {
        const owner = readLockOwner();
        if (owner && owner[0] === deadPid) {
            // The previous run was killed before it could release the lock. Stop the suite it left
            // running, so two runs never write their results at the same time.
            if (suiteGroup) stopGroup(suiteGroup, "SIGKILL");
            fs.rmSync(LOCK_FILE, { force: true });
        }
        return true;
    } finally {
        fs.rmSync(TAKEOVER_FILE, { force: true });
    }
}

function tryTakeTakeover() {
    try {
        fs.writeFileSync(TAKEOVER_FILE, String(process.pid), { flag: "wx" });
        return true;
    } catch (err) {
        if (err.code !== "EEXIST") throw err;
    }
    // A run killed while it held the takeover lock leaves it behind. Clear it and look again next
    // time.
    try {
        if (!pidAlive(Number(fs.readFileSync(TAKEOVER_FILE, "utf8"))))
            fs.rmSync(TAKEOVER_FILE, { force: true });
    } catch (err) {
        if (err.code !== "ENOENT") throw err;
    }
    return false;
}

function tryTakeLock() {
    try {
        fs.writeFileSync(LOCK_FILE, String(process.pid), { flag: "wx" });
        isLockHeld = true;
        return true;
    } catch (err) {
        if (err.code !== "EEXIST") throw err;
    }
    const owner = readLockOwner();
    if (!owner) return tryTakeLock();
    const [ownerPid, suiteGroup] = owner;
    if (pidAlive(ownerPid)) return false;
    if (!clearDeadLock(ownerPid, suiteGroup)) return false;
    return tryTakeLock();
}

// Returns false when the Run Tests limit passes before the other run frees the lock.
async function takeLock() {
    fs.mkdirSync(path.dirname(LOCK_FILE), { recursive: true });
    let isAnnounced = false;
    while (!tryTakeLock()) {
        if (Date.now() >= runDeadline) return false;
        if (!isAnnounced) {
            console.log("Waiting for another test run to finish...");
            isAnnounced = true;
        }
        await sleep(LOCK_POLL_MS);
    }
    return true;
}

function releaseLock() {
    try {
        if (Number(fs.readFileSync(LOCK_FILE, "utf8").split(" ")[0]) === process.pid)
            fs.rmSync(LOCK_FILE);
    } catch (err) {
        if (err.code !== "ENOENT") throw err;
    }
    isLockHeld = false;
}

// The suite's first process can exit before the ones it started (a forked test JVM). Wait for the
// whole group, so the next run never starts while this one is still shutting down.
async function waitForGroupExit(groupId) {
    const killAt = Date.now() + KILL_GRACE_MS;
    const giveUpAt = killAt + KILL_GRACE_MS;
    while (pidAlive(-groupId) && Date.now() < giveUpAt) {
        if (Date.now() >= killAt) stopGroup(groupId, "SIGKILL");
        await sleep(GROUP_POLL_MS);
    }
}

function stopSuite(suite, signal) {
    suite.isStopping = true;
    stopGroup(suite.pid, signal);
    setTimeout(() => stopGroup(suite.pid, "SIGKILL"), KILL_GRACE_MS).unref();
}

// The suite outlives this runner when the runner is killed outright (the IDE closing the Test
// terminal can do that), so a separate process watches it. It runs this same file with
// WATCHDOG_FLAG, in its own session, so nothing that stops the runner reaches it.
function startWatchdog(suiteGroup) {
    const args = [__filename, WATCHDOG_FLAG, process.pid, suiteGroup, runDeadline].map(String);
    const watchdog = spawn(process.execPath, args, { stdio: "ignore", detached: true });
    // Without a watchdog the run still works, as it did before there was one.
    watchdog.on("error", () => {});
    return watchdog;
}

// Waits for the watchdog to exit, so a finished run never leaves it behind.
function stopWatchdog(watchdog) {
    if (!watchdog.pid || watchdog.exitCode !== null || watchdog.signalCode !== null)
        return Promise.resolve();
    return new Promise((resolve) => {
        watchdog.once("exit", resolve);
        watchdog.kill();
    });
}

// Stops the suite's group when the runner is gone, or one poll after the run's limit (the runner
// stops it at the limit itself while it can, and says so). It signals only that group, and exits
// once the group is gone.
async function runWatchdog(runnerPid, suiteGroup, deadline) {
    if (!Number.isInteger(suiteGroup) || suiteGroup <= 1) return;
    // The runner is this process's parent, so a reused pid can't make a dead runner look alive.
    const isRunnerGone = () => process.ppid !== runnerPid || !pidAlive(runnerPid);
    while (pidAlive(-suiteGroup)) {
        if (isRunnerGone() || Date.now() >= deadline + WATCHDOG_POLL_MS) {
            stopGroup(suiteGroup, "SIGTERM");
            await waitForGroupExit(suiteGroup);
            return;
        }
        await sleep(WATCHDOG_POLL_MS);
    }
}

function runFileFor(index) {
    return path.join(RUNS_DIR, `run-${process.pid}-${index}.xml`);
}

// Each suite runs in its own process group, so a time-out or Ctrl+C also stops the test runner's
// own child processes (a forked JVM, Jest workers).
function runSuite(suite, runFile) {
    if (Date.now() >= runDeadline) {
        console.error(
            `${suite.name} tests did not start: Run Tests reached its ${RUN_LIMIT_MS / 60_000}-minute limit.`,
        );
        return Promise.resolve(FAILED_EXIT_CODE);
    }
    return new Promise((resolve) => {
        const [command, ...args] = suite.command(runFile);
        const child = spawn(command, args, {
            cwd: path.join(ROOT, suite.cwd),
            env: { ...process.env, ...(suite.env ? suite.env(runFile) : {}) },
            stdio: "inherit",
            detached: true,
        });
        activeSuite = child;
        fs.writeFileSync(LOCK_FILE, `${process.pid} ${child.pid}`);
        const watchdog = child.pid ? startWatchdog(child.pid) : null;
        const limit = setTimeout(() => {
            console.error(
                `${suite.name} tests were stopped at the ${RUN_LIMIT_MS / 60_000}-minute Run Tests limit.`,
            );
            stopSuite(child, "SIGTERM");
        }, runDeadline - Date.now());
        child.on("error", (err) => {
            console.error(`Could not start the ${suite.name} tests: ${err.message}`);
        });
        // A suite that never started, or was stopped by a signal, has no exit code of its own.
        child.on("close", async (code) => {
            clearTimeout(limit);
            if (child.isStopping) await waitForGroupExit(child.pid);
            if (watchdog) await stopWatchdog(watchdog);
            activeSuite = null;
            resolve(Number.isInteger(code) && code >= 0 ? code : FAILED_EXIT_CODE);
        });
    });
}

// Only the lock holder runs this, so every run file left here belongs to a killed run.
function removeLeftoverRunFiles() {
    for (const name of fs.readdirSync(RUNS_DIR)) {
        if (RUN_FILE_PATTERN.test(name)) fs.rmSync(path.join(RUNS_DIR, name), { force: true });
    }
}

// Each scored file is renamed into place, so it never holds half of a run's results. A suite that
// wrote no results publishes nothing, so an empty file can never read as "no tests failed".
function writeScoredFiles() {
    for (const [index, suite] of SUITES.entries()) {
        const runFile = runFileFor(index);
        if (!fs.existsSync(runFile)) continue;
        const scoredFile = path.join(ROOT, suite.scoredFile);
        fs.mkdirSync(path.dirname(scoredFile), { recursive: true });
        fs.renameSync(runFile, scoredFile);
    }
}

function escapeXml(text) {
    return text.replace(/[&<>"']/g, (char) => XML_ESCAPES[char]);
}

function unescapeXml(text) {
    return text.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (entity, code) => {
        if (code.startsWith("#x")) return String.fromCodePoint(parseInt(code.slice(2), 16));
        if (code.startsWith("#")) return String.fromCodePoint(Number(code.slice(1)));
        return Object.keys(XML_ESCAPES).find((char) => XML_ESCAPES[char] === entity);
    });
}

// Both reporters write one <testcase> per test. jest-junit names its test file in a `file`
// attribute (addFileAttribute in jest.config.js), Vitest in `classname`. Both are relative to the
// suite's folder.
function reportedTestcases(report) {
    return [...report.matchAll(/<testcase\b([^>]*?)\/?>/g)].map(([, attributes]) => {
        const values = Object.fromEntries(
            [...attributes.matchAll(/([\w:-]+)="([^"]*)"/g)].map(([, key, value]) => [
                key,
                unescapeXml(value),
            ]),
        );
        return {
            classname: values.classname ?? "",
            name: values.name ?? "",
            file: values.file ?? values.classname ?? "",
        };
    });
}

function testcaseKey({ classname, name, file }) {
    return JSON.stringify([classname, name, file]);
}

function didNotRunSuite(testcases) {
    const failure = `<failure type="DidNotRun" message="${escapeXml(DID_NOT_RUN_MESSAGE)}"/>`;
    const cases = testcases.map(
        ({ classname, name, file }) =>
            `\t\t<testcase classname="${escapeXml(classname)}" name="${escapeXml(name)}" file="${escapeXml(file)}" time="0">${failure}</testcase>\n`,
    );

    return `\t<testsuite name="did not run" tests="${testcases.length}" failures="${testcases.length}" errors="0" skipped="0" time="0">\n${cases.join("")}\t</testsuite>\n`;
}

// One failed testcase in place of a suite that wrote no results, so its file is never missing.
function writeEndedEarlyReport(suite) {
    const name = `${suite.name} tests ended early`;
    const failure = `<failure type="EndedEarly" message="${escapeXml(`${suite.name} tests ${ENDED_EARLY_MESSAGE}`)}"/>`;
    const testcase = `\t\t<testcase classname="${escapeXml(name)}" name="${escapeXml(name)}" time="0">${failure}</testcase>\n`;
    const report = `<?xml version="1.0" encoding="UTF-8"?>\n<testsuites tests="1" failures="1">\n\t<testsuite name="${escapeXml(name)}" tests="1" failures="1" errors="0" skipped="0" time="0">\n${testcase}\t</testsuite>\n</testsuites>\n`;
    const scoredFile = path.join(ROOT, suite.scoredFile);
    const runFile = runFileFor(`ended-early-${suite.name.toLowerCase()}`);
    fs.writeFileSync(runFile, report);
    fs.mkdirSync(path.dirname(scoredFile), { recursive: true });
    fs.renameSync(runFile, scoredFile);
}

// Adds the suite before the closing root tag, and keeps the root's own totals in step when the
// reporter writes them.
function withDidNotRun(report, testcases) {
    const end = report.lastIndexOf("</testsuites>");
    const added = report.slice(0, end) + didNotRunSuite(testcases) + report.slice(end);

    return added.replace(/<testsuites\b[^>]*>/, (root) =>
        root.replace(
            /\b(tests|failures)="(\d+)"/g,
            (_, key, value) => `${key}="${Number(value) + testcases.length}"`,
        ),
    );
}

// A broken list must not stop the run, so it is reported and ignored.
function readExpectedTestcases() {
    try {
        return JSON.parse(fs.readFileSync(EXPECTED_FILE, "utf8"));
    } catch (error) {
        console.error(`Ignoring ${path.relative(ROOT, EXPECTED_FILE)}: ${error.message}`);
        return null;
    }
}

// Without a readable report (the suite crashed or was stopped first), every expected testcase of
// that file is missing. Returns how many testcases were added as failed.
function addTestsThatDidNotRun() {
    if (!fs.existsSync(EXPECTED_FILE)) return 0;

    const expected = readExpectedTestcases();
    if (!expected) return 0;
    let addedCount = 0;

    for (const [index, suite] of SUITES.entries()) {
        const scoredFile = path.join(ROOT, suite.scoredFile);
        const existing = fs.existsSync(scoredFile) ? fs.readFileSync(scoredFile, "utf8") : "";
        const report = existing.includes("</testsuites>") ? existing : EMPTY_REPORT;
        const reported = new Set(reportedTestcases(report).map(testcaseKey));
        const missing = (expected[suite.scoredFile] ?? []).filter(
            (testcase) => !reported.has(testcaseKey(testcase)),
        );

        if (!missing.length) continue;
        // Written next to the run files and renamed into place, like the suites' own results.
        const runFile = runFileFor(`expected-${index}`);
        fs.writeFileSync(runFile, withDidNotRun(report, missing));
        fs.mkdirSync(path.dirname(scoredFile), { recursive: true });
        fs.renameSync(runFile, scoredFile);
        console.error(
            `${suite.name}: ${missing.length} expected test(s) did not run, so they count as failed.`,
        );
        addedCount += missing.length;
    }

    return addedCount;
}

// For the question's author, on a ticket's solution branch after a change to its hidden tests:
// lists the testcases this run reported from the named hidden test files only. A visible test is
// never listed, so a visible test the solution renames can't count as "did not run" for every
// candidate. Keep the file on solution-prod as scoring/<ticket>/expected-testcases.json and upload
// it with that ticket's hidden tests as scoring/expected-testcases.json.
function recordExpectedTestcases() {
    if (!recordedTestFiles.length) {
        console.error(
            `Name the ticket's hidden test files after ${RECORD_EXPECTED_FLAG}, for example backend/__tests__/tickets/notes.behavior.test.js.`,
        );
        return false;
    }

    const expected = {};

    for (const suite of SUITES) {
        const scoredFile = path.join(ROOT, suite.scoredFile);
        const reported = fs.existsSync(scoredFile)
            ? reportedTestcases(fs.readFileSync(scoredFile, "utf8"))
            : [];
        const hidden = reported.filter(({ file }) =>
            recordedTestFiles.includes(path.posix.join(suite.cwd, file)),
        );

        if (hidden.length) expected[suite.scoredFile] = hidden;
    }

    for (const testFile of recordedTestFiles) {
        const count = Object.values(expected)
            .flat()
            .filter(({ file }) => testFile.endsWith(`/${file}`)).length;
        console.log(`${testFile}: ${count} testcases`);
    }

    fs.mkdirSync(path.dirname(EXPECTED_FILE), { recursive: true });
    fs.writeFileSync(EXPECTED_FILE, `${JSON.stringify(expected, null, "\t")}\n`);
    console.log(
        `Wrote ${Object.values(expected).flat().length} expected testcases to ${path.relative(ROOT, EXPECTED_FILE)}.`,
    );
    return true;
}

// Ctrl+C only asks the suite to stop. main() frees the lock once the suite has really stopped.
function onInterrupt(signal) {
    if (!isLockHeld) process.exit(INTERRUPTED_EXIT_CODE);
    isInterrupted = true;
    if (activeSuite) stopSuite(activeSuite, signal);
}

async function main() {
    process.on("SIGINT", onInterrupt);
    process.on("SIGTERM", onInterrupt);
    // The IDE closing the Test terminal sends SIGHUP. Stop the suite as for SIGTERM.
    process.on("SIGHUP", () => onInterrupt("SIGTERM"));
    if (!(await takeLock())) {
        console.error(
            `Stopped waiting: another test run held the lock for the whole ${RUN_LIMIT_MS / 60_000}-minute Run Tests limit. Run Tests again.`,
        );
        process.exitCode = FAILED_EXIT_CODE;
        return;
    }
    try {
        fs.mkdirSync(RUNS_DIR, { recursive: true });
        for (const suite of SUITES) fs.rmSync(path.join(ROOT, suite.scoredFile), { force: true });
        removeLeftoverRunFiles();
        const exitCodes = [];
        for (const [index, suite] of SUITES.entries()) {
            if (isInterrupted) break;
            exitCodes.push(await runSuite(suite, runFileFor(index)));
        }
        if (isInterrupted) {
            removeLeftoverRunFiles();
            process.exitCode = INTERRUPTED_EXIT_CODE;
            return;
        }
        writeScoredFiles();
        // A suite whose process was ended early (process.exit in a test or in the code it runs) can
        // exit 0 without a results file. HackerRank would then score the other suite alone, so the
        // suite's scored file gets one failed testcase saying so, and this run fails.
        const silentSuites = SUITES.filter(
            (suite) => !fs.existsSync(path.join(ROOT, suite.scoredFile)),
        );
        for (const suite of silentSuites) {
            console.error(`${suite.name} tests ${ENDED_EARLY_MESSAGE}.`);
            writeEndedEarlyReport(suite);
        }
        const isPassed = exitCodes.every((code) => code === 0) && silentSuites.length === 0;

        if (isRecording) {
            if (!isPassed)
                console.error(
                    "Expected testcases not recorded: record them from a run where every test passes.",
                );
            process.exitCode = isPassed && recordExpectedTestcases() ? 0 : FAILED_EXIT_CODE;
            return;
        }

        const didNotRunCount = addTestsThatDidNotRun();
        process.exitCode = isPassed && didNotRunCount === 0 ? 0 : FAILED_EXIT_CODE;
    } finally {
        releaseLock();
    }
}

if (process.argv[2] === WATCHDOG_FLAG) {
    runWatchdog(...process.argv.slice(3).map(Number));
} else {
    main();
}
