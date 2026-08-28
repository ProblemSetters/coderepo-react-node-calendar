export default {
    testEnvironment: "node",
    testTimeout: 15000,
    testMatch: ["<rootDir>/__tests__/**/*.test.js"],
    reporters: ["default", ["jest-junit", { outputDirectory: "../output", outputName: "results.xml" }]],
    collectCoverageFrom: ["src/features/**/*.js", "!src/**/index.js"],
};
