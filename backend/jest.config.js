export default {
    testEnvironment: "node",
    roots: ["<rootDir>/__tests__"],
    testMatch: ["**/*.behavior.test.js"],
    testTimeout: 30000,
    reporters: process.env.JEST_JUNIT_OUTPUT_NAME
        ? [
            "default",
            [
                "jest-junit",
                {
                    outputDirectory: "<rootDir>/../output",
                    outputName: process.env.JEST_JUNIT_OUTPUT_NAME,
                },
            ],
        ]
        : ["default"],
    silent: true,
    verbose: true,
    forceExit: true,
    detectOpenHandles: true,
    clearMocks: true,
    resetMocks: true,
    restoreMocks: true,
    collectCoverageFrom: ["src/features/**/*.js", "!src/**/index.js"],
};
