import { dropTestDatabases } from "./global-setup.js";
import { loadEnvironment } from "./test-database.js";

// Drops this run's own test database, even when a test file never cleaned up after itself.
export default async function globalTeardown() {
    loadEnvironment();
    const runId = process.env.TEST_RUN_ID;
    if (runId) await dropTestDatabases((name) => name === runId);
}
