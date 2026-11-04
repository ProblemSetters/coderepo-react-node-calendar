import mongoose from "mongoose";
import { SCORING_RUN, appDatabaseName, appDatabaseUri, loadEnvironment, testDatabaseName } from "./test-database.js";

const SERVICE_TIMEOUT_MS = 3000;

function isAlive(pid) {
    try {
        process.kill(pid, 0);
        return true;
    } catch (error) {
        return error.code === "EPERM";
    }
}

// Drops the test databases shouldDrop picks. Only this app's own test databases (<db>_test_...)
// are ever looked at, so another project's data on the same MongoDB is never touched.
export async function dropTestDatabases(shouldDrop) {
    const prefix = `${appDatabaseName()}_test_`;
    const connection = mongoose.createConnection(appDatabaseUri(), { serverSelectionTimeoutMS: SERVICE_TIMEOUT_MS });
    try {
        await connection.asPromise();
    } catch {
        await connection.close().catch(() => {});
        throw new Error(`The tests need MongoDB at ${appDatabaseUri()}, and it did not answer. Click Install or Run to start it, then run the tests again.`);
    }
    try {
        const { databases } = await connection.db.admin().listDatabases({ nameOnly: true });
        for (const { name } of databases) {
            if (name.startsWith(prefix) && shouldDrop(name.slice(prefix.length))) await connection.client.db(name).dropDatabase();
        }
    } finally {
        await connection.close();
    }
}

// Run Tests starts from an empty <db>_test_scoring. Every other run gets its own database, and the
// databases left by runs that were killed before their teardown are dropped here.
export default async function globalSetup() {
    loadEnvironment();
    if (process.env.TEST_RUN === SCORING_RUN) {
        await dropTestDatabases((runId) => runId === SCORING_RUN);
        return;
    }
    process.env.TEST_RUN_ID = process.env.TEST_RUN_ID || String(process.pid);
    await dropTestDatabases((runId) => /^\d+$/.test(runId) && !isAlive(Number(runId)));
}

export { testDatabaseName };
