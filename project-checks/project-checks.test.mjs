import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import net from "node:net";
import { fileURLToPath } from "node:url";
let parseAllDocuments, Ajv, XMLParser, XMLValidator;
if (process.env.PROJECT_CHECK_ACTIVE !== "1") {
    ({ parseAllDocuments } = await import("yaml"));
    ({ default: Ajv } = await import("ajv-draft-04"));
    ({ XMLParser, XMLValidator } = await import("fast-xml-parser"));
}

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.env.PROJECT_ROOT || process.cwd());
const DIRS = ["frontend", "frontend/src", "frontend/src/features", "frontend/src/shared", "backend", "backend/src", "backend/src/features", "backend/src/shared", "backend/src/scripts", ".vscode"];
const EXCLUDED = new Set([".git", "project-checks", "node_modules", ".venv", "venv", ".gradle", ".m2", ".cache", "__pycache__", ".ruff_cache"]);
const GENERATED = new Set(["dist", "build", "coverage", "frontend/dist", "frontend/build", "frontend/coverage", "backend/dist", "backend/build", "backend/coverage", "backend/target"]);
const EXACT = /^[v=]?\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;
const REPORT_ROOTS = new Set(["testsuite", "testsuites", "testng-results", "testrun"]);
const processes = new Set();
let interrupted = false;

function walk(root, generated = true, relative = "") {
    return fs.readdirSync(path.join(root, relative), { withFileTypes: true }).flatMap((entry) => {
        const name = path.posix.join(relative, entry.name);
        if (EXCLUDED.has(entry.name) || (generated && GENERATED.has(name))) return [];
        assert.ok(!entry.isSymbolicLink(), `Cannot reliably inspect symbolic path: ${name}`);
        if (entry.isDirectory()) return walk(root, generated, name);
        assert.ok(entry.isFile(), `Expected a regular file: ${name}`);
        return [name];
    });
}

function configuration() {
    const documents = parseAllDocuments(fs.readFileSync(path.join(ROOT, "hackerrank.yml"), "utf8"), { uniqueKeys: true, merge: true });
    assert.equal(documents.length, 1, "Configuration must contain one YAML document");
    assert.deepEqual(documents[0].errors, [], "Invalid YAML configuration");
    const data = documents[0].toJS();
    const validate = new Ajv({ strict: false }).compile(JSON.parse(fs.readFileSync(path.join(HERE, "project-config.schema.json"), "utf8")));
    assert.ok(validate(data), JSON.stringify(validate.errors));
    const menu = data.configuration.ide_config.project_menu;
    for (const name of ["install", "run", ...(Object.hasOwn(menu, "test") ? ["test"] : [])]) assert.ok(typeof menu[name] === "string" && menu[name].trim(), `Missing ${name} command`);
    if (data.configuration.scoring) assert.ok(data.configuration.scoring.command?.trim(), "Missing scoring command");
    return data.configuration;
}

function testCommand(config, workspace) {
    if (Object.hasOwn(config.ide_config.project_menu, "test")) return config.ide_config.project_menu.test;
    const manifest = JSON.parse(fs.readFileSync(path.join(workspace, "package.json"), "utf8"));
    const scripts = manifest.scripts;
    if (scripts === undefined) return null;
    assert.ok(scripts && typeof scripts === "object" && !Array.isArray(scripts), "Root package.json scripts must be an object");
    if (!Object.hasOwn(scripts, "test")) return null;
    assert.ok(typeof scripts.test === "string" && scripts.test.trim(), "Root package.json scripts.test must be a nonblank string");
    const declared = typeof manifest.packageManager === "string" ? manifest.packageManager.split("@")[0] : "";
    const manager = ["bun", "npm", "pnpm", "yarn"].includes(declared) ? declared :
        [["bun.lock", "bun"], ["bun.lockb", "bun"], ["pnpm-lock.yaml", "pnpm"], ["yarn.lock", "yarn"], ["package-lock.json", "npm"], ["npm-shrinkwrap.json", "npm"]]
            .find(([filename]) => fs.existsSync(path.join(workspace, filename)))?.[1] || "npm";
    return `${manager} run test`;
}

function pinned(version) {
    if (EXACT.test(version)) return true;
    if (version.startsWith("npm:")) return EXACT.test(version.slice(version.lastIndexOf("@") + 1));
    return /^(?:git\+|git:|github:|gitlab:|bitbucket:)/.test(version) && /#[a-f0-9]{40}$/i.test(version);
}

function dependencies() {
    const names = new Map();
    const manifests = walk(ROOT).filter((name) => path.basename(name) === "package.json").map((name) => {
        const data = JSON.parse(fs.readFileSync(path.join(ROOT, name), "utf8"));
        assert.ok(data && !Array.isArray(data) && typeof data === "object", `${name} must contain an object`);
        if (data.name) names.set(data.name, (names.get(data.name) || 0) + 1);
        return [name, data];
    });
    assert.ok(manifests.some(([name]) => name === "package.json"), "Root package.json is required");
    const errors = [];
    for (const [name, data] of manifests) for (const section of ["dependencies", "devDependencies", "optionalDependencies", "peerDependencies"]) {
        assert.ok(data[section] === undefined || (data[section] && typeof data[section] === "object" && !Array.isArray(data[section])), `${name}: invalid ${section}`);
        for (const [dependency, raw] of Object.entries(data[section] || {})) {
            const version = typeof raw === "string" ? raw.trim() : "";
            let exact = pinned(version);
            if (version.startsWith("workspace:")) exact = names.get(dependency) === 1;
            if (/^(?:file|link):/.test(version)) {
                const reference = version.slice(version.indexOf(":") + 1);
                const target = path.resolve(ROOT, path.dirname(name), reference);
                const relative = path.relative(ROOT, target);
                exact = !!reference && !relative.startsWith("..") && !path.isAbsolute(relative) && fs.existsSync(target) && fs.realpathSync(target).startsWith(fs.realpathSync(ROOT) + path.sep);
            }
            if (!exact) errors.push(`${name}: ${section}.${dependency} is not pinned: ${JSON.stringify(raw)}`);
        }
    }
    assert.deepEqual(errors, []);
}

function reportRoot(filename) {
    const text = fs.readFileSync(filename, "utf8");
    const validation = XMLValidator.validate(text);
    assert.equal(validation, true, `Invalid XML in ${filename}: ${JSON.stringify(validation)}`);
    const parsed = new XMLParser({ ignoreAttributes: false, processEntities: false, removeNSPrefix: true }).parse(text);
    const roots = Object.keys(parsed).filter((key) => !key.startsWith("?"));
    assert.equal(roots.length, 1, `Expected one XML root in ${filename}`);
    return roots[0].toLowerCase();
}

function reportHint(name) {
    return /(?:^|\/)(?:test-results|test-reports|surefire-reports|failsafe-reports)\//i.test(name) || /^(?:TEST-|junit)|^test[-_]results\.xml$|^test[-_]report\.xml$|^testng-results\.xml$/i.test(path.basename(name));
}

function matches(pattern, name) {
    const segment = (value) => new RegExp("^" + value.replace(/[.+^${}()|\\]/g, "\\$&").replaceAll("*", "[^/]*").replaceAll("?", "[^/]") + "$");
    const parts = name.split("/");
    let previous = [true, ...parts.map(() => false)];
    for (const part of pattern.split("/")) {
        const next = new Array(parts.length + 1).fill(false);
        if (part === "**") next[0] = previous[0];
        for (let index = 1; index <= parts.length; index++) next[index] = part === "**" ? previous[index] || next[index - 1] : previous[index - 1] && segment(part).test(parts[index - 1]);
        previous = next;
    }
    return previous[parts.length];
}

function reports(root, patterns) {
    const found = new Map();
    for (const name of walk(root, false)) if (/\.xml$/i.test(name) && patterns.some((pattern) => matches(pattern, name))) {
        const stat = fs.statSync(path.join(root, name));
        found.set(name, `${stat.ino}:${stat.size}:${stat.mtimeMs}`);
    }
    return found;
}

function launch(script, cwd) {
    assert.ok(!interrupted, "Execution interrupted");
    const environment = { ...process.env, PROJECT_CHECK_ACTIVE: "1" };
    // The outer test runner sets this internal flag; application tests need a
    // fresh runner rather than Node treating them as recursive collection.
    delete environment.NODE_TEST_CONTEXT;
    const child = spawn("bash", ["-e", "-o", "pipefail", "-c", script], { cwd, detached: true, env: environment, stdio: ["ignore", "pipe", "pipe"] });
    const item = { child, output: "", finished: false, code: null, started: performance.now() };
    item.done = new Promise((resolve) => {
        for (const stream of [child.stdout, child.stderr]) stream.on("data", (data) => { if (item.output.length < 1048576) item.output += data.toString().slice(0, 1048576 - item.output.length); });
        child.once("error", (error) => { item.finished = true; item.output += error.message; resolve(item); });
        child.once("close", (code) => { item.finished = true; item.code = code; resolve(item); });
    });
    processes.add(item);
    return item;
}

async function stop(item) {
    if (!item?.child.pid) return;
    const signal = (value) => { try { process.kill(-item.child.pid, value); } catch (error) { if (error.code !== "ESRCH") throw error; } };
    signal("SIGTERM");
    await Promise.race([item.done, new Promise((resolve) => setTimeout(resolve, 200))]);
    signal("SIGKILL");
    await item.done;
    processes.delete(item);
}

async function complete(item, seconds) {
    let timer;
    try {
        await Promise.race([item.done, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Command timed out after ${seconds}s`)), seconds * 1000); })]);
        assert.equal(item.code, 0, item.output || "Command failed");
    } finally { clearTimeout(timer); }
}

async function portsFree(urls) {
    for (const value of urls) {
        const url = new URL(value);
        assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(url.hostname), "Readiness URLs must be local");
        const occupied = await new Promise((resolve) => {
            const connection = net.connect({ host: url.hostname.replaceAll("[", "").replaceAll("]", ""), port: Number(url.port || (url.protocol === "https:" ? 443 : 80)) });
            connection.setTimeout(250);
            connection.once("connect", () => { connection.destroy(); resolve(true); });
            connection.once("error", () => { connection.destroy(); resolve(false); });
            connection.once("timeout", () => { connection.destroy(); resolve(false); });
        });
        assert.ok(!occupied, `Readiness port is already occupied: ${value}`);
    }
}

const quote = (value) => `'${value.replaceAll("'", `'"'"'`)}'`;

function tool(name) {
    for (const parent of ["", "frontend", "backend"]) {
        const filename = path.join(ROOT, parent, "node_modules/.bin", name);
        if (fs.existsSync(filename)) return filename;
    }
    return name;
}

describe("Project checks", { concurrency: false, skip: process.env.PROJECT_CHECK_ACTIVE === "1" }, () => {
    after(async () => { for (const item of processes) await stop(item); });
    test("Root README.md exists", () => {
        assert.ok(fs.readdirSync(ROOT).includes("README.md") && fs.statSync(path.join(ROOT, "README.md")).isFile(), "Root README.md must exist as a file");
    });
    test("No existing XML test reports", () => {
        const found = walk(ROOT, false).filter((name) => /\.xml$/i.test(name) && (reportHint(name) || REPORT_ROOTS.has(reportRoot(path.join(ROOT, name)))));
        assert.deepEqual(found, [], "Generate XML reports when tests run; do not include existing reports");
    });
    test("Required paths exist; files, empty and additional folders are allowed", () => {
        for (const name of DIRS) {
            let parent = ROOT;
            for (const part of name.split("/")) {
                assert.ok(fs.readdirSync(parent).includes(part), `Missing required path: ${name}`);
                parent = path.join(parent, part);
                const entry = fs.statSync(parent);
                // A regular file may replace the entry and its directory subtree.
                if (entry.isFile()) break;
                assert.ok(entry.isDirectory(), `Unsupported entry: ${name}`);
            }
        }
    });
    test("Configuration format, required install/run and optional test/scoring", () => { configuration(); });
    test("Direct dependencies are pinned", dependencies);
    test("JavaScript and React lint", async () => {
        const files = walk(ROOT).filter((name) => /\.[cm]?jsx?$/.test(name));
        if (!files.length) return;
        const args = [tool("eslint"), "--no-config-lookup", "--no-inline-config", "--no-ignore", "--max-warnings", "0", "--config", path.join(HERE, "eslint.config.mjs"), "--", ...files.map((name) => "./" + name)];
        const item = launch(args.map(quote).join(" "), ROOT);
        try { await complete(item, Number(process.env.CHECK_LINT_TIMEOUT_SECONDS || 120)); } finally { await stop(item); }
    });
    test("Install, run, test and generate XML", async (t) => {
        const config = configuration();
        const workspace = fs.mkdtempSync(path.join(os.tmpdir(), "project-check-"));
        const started = [];
        const timeout = (name, fallback) => { const value = Number(process.env[`CHECK_${name}_TIMEOUT_SECONDS`] || fallback); assert.ok(Number.isFinite(value) && value > 0, `Invalid ${name} timeout`); return value; };
        try {
            walk(ROOT);
            fs.cpSync(ROOT, workspace, { recursive: true, preserveTimestamps: true, filter: (source) => {
                const name = path.relative(ROOT, source).split(path.sep).join("/");
                return !name.split("/").some((component) => EXCLUDED.has(component)) && !GENERATED.has(name);
            } });
            const menu = config.ide_config.project_menu;
            const install = launch(menu.install, workspace); started.push(install);
            await complete(install, timeout("INSTALL", 600));
            t.diagnostic(`Install: ${((performance.now() - install.started) / 1000).toFixed(3)}s`);
            const urls = JSON.parse(process.env.CHECK_READY_URLS || '["http://127.0.0.1:3000/","http://127.0.0.1:8000/"]');
            assert.ok(Array.isArray(urls) && urls.length, "Specify readiness URLs");
            await portsFree(urls);
            const app = launch(menu.run, workspace); started.push(app);
            const deadline = performance.now() + timeout("STARTUP", 120) * 1000;
            for (;;) {
                assert.ok(!app.finished && !interrupted, `Run command exited: ${app.output}`);
                const ready = await Promise.all(urls.map(async (url) => { try { const response = await fetch(url, { redirect: "manual", signal: AbortSignal.timeout(1000) }); await response.body?.cancel(); return response.status < 500; } catch { return false; } }));
                if (ready.every(Boolean)) break;
                assert.ok(performance.now() < deadline, `Startup timed out: ${app.output}`);
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            t.diagnostic(`Startup: ${((performance.now() - app.started) / 1000).toFixed(3)}s`);
            const selectedTest = testCommand(config, workspace);
            if (selectedTest === null) {
                t.diagnostic("Test and generated XML checks skipped: no test command configured");
                return;
            }
            t.diagnostic(`Test command source: ${Object.hasOwn(menu, "test") ? "hackerrank.yml" : "root package.json scripts.test"}; command: ${selectedTest}`);
            const patterns = (config.scoring?.files || []).filter((name) => typeof name === "string" && /\.xml$/i.test(name));
            if (config.scoring?.files !== undefined) assert.ok(patterns.length, "Scoring files must specify XML reports");
            else t.diagnostic("Generated XML checks skipped: no scoring files configured");
            for (const pattern of patterns) assert.ok(!path.isAbsolute(pattern) && !pattern.split("/").includes("..") && !pattern.includes("\\"), `Invalid XML report path: ${pattern}`);
            const before = reports(workspace, patterns);
            const command = launch(selectedTest, workspace); started.push(command);
            let testError;
            try { await Promise.race([complete(command, timeout("TEST", 300)), app.done.then(() => { throw new Error(`App exited while tests were running: ${app.output}`); })]); } catch (error) { testError = error; }
            t.diagnostic(`Test: ${((performance.now() - command.started) / 1000).toFixed(3)}s\n${command.output}`);
            assert.ok(command.finished, testError?.message || "Test command did not finish");
            const after = reports(workspace, patterns);
            const errors = testError ? [testError.message] : [];
            for (const pattern of patterns) {
                const names = [...after.keys()].filter((name) => matches(pattern, name));
                if (!names.length) errors.push(`XML report not generated: ${pattern}`);
                for (const name of names) {
                    if (before.get(name) === after.get(name)) errors.push(`XML report is stale: ${name}`);
                    try { assert.ok(REPORT_ROOTS.has(reportRoot(path.join(workspace, name))), `Not a test report: ${name}`); } catch (error) { errors.push(error.message); }
                }
            }
            assert.ok(!app.finished, `Run command exited during tests: ${app.output}`);
            assert.deepEqual(errors, []);
        } finally { for (const item of started.reverse()) await stop(item); fs.rmSync(workspace, { recursive: true, force: true }); }
    });
});

for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { interrupted = true; process.exitCode = 1; for (const item of processes) void stop(item); });
