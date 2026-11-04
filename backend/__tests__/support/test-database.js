import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_URI = "mongodb://127.0.0.1:27017/calendar_db";

// Reads backend/.env without overriding anything already set in the shell.
export function loadEnvironment() {
    dotenv.config({ path: path.join(backendDirectory, ".env"), quiet: true });
}

export function appDatabaseUri() {
    return process.env.MONGODB_URI || DEFAULT_URI;
}

export function appDatabaseName() {
    return new URL(appDatabaseUri()).pathname.replace(/^\//, "") || "calendar_db";
}

// Every run uses <db>_test_<run id>, so two runs
// never share data and the app's own database is never touched.
export function testDatabaseName(runId) {
    return `${appDatabaseName()}_test_${runId}`;
}

export function testDatabaseUri(runId) {
    const uri = new URL(appDatabaseUri());
    uri.pathname = `/${testDatabaseName(runId)}`;
    return uri.toString();
}

export function runId() {
    return process.env.TEST_RUN_ID || String(process.pid);
}
