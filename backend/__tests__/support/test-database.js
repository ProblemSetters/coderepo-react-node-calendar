import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const backendDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_URI = "mongodb://127.0.0.1:27017/calendar_db";

// Reads backend/.env without overriding anything already set in the shell.
export function loadEnvironment() {
    dotenv.config({ path: path.join(backendDirectory, ".env"), quiet: true });
}

// The tests use <app database>_test, so the app's own data is never touched.
export function testDatabaseUri() {
    const uri = new URL(process.env.MONGODB_URI || DEFAULT_URI);
    const database = uri.pathname.replace(/^\//, "") || "calendar_db";
    uri.pathname = database.endsWith("_test") ? `/${database}` : `/${database}_test`;
    return uri.toString();
}
