// A test whose request never gets an answer fails after this long. The slowest test takes under a
// second, so a whole file of hanging tests still ends in a few minutes.
const TEST_TIMEOUT_MS = 15000;

// reportTestSuiteErrors writes a failed testcase for a test file that fails to load, so it can
// never vanish from the results.
const junitReporter = ["jest-junit", { reportTestSuiteErrors: true, addFileAttribute: "true" }];

export default {
    testEnvironment: "node",
    roots: ["<rootDir>/__tests__"],
    testMatch: ["**/*.test.js"],
    transform: {},
    globalSetup: "<rootDir>/__tests__/support/global-setup.js",
    globalTeardown: "<rootDir>/__tests__/support/global-teardown.js",
    setupFiles: ["<rootDir>/__tests__/support/environment.js"],
    testTimeout: TEST_TIMEOUT_MS,
    maxWorkers: 1,
    forceExit: true,
    reporters: process.env.JEST_JUNIT_OUTPUT_DIR ? ["default", junitReporter] : ["default"],
};
