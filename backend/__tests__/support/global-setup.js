import mongoose from "mongoose";
import { loadEnvironment, testDatabaseUri } from "./test-database.js";

// Starts every run from an empty test database.
export default async function globalSetup() {
    loadEnvironment();
    const uri = testDatabaseUri();
    const connection = mongoose.createConnection(uri, { serverSelectionTimeoutMS: 3000 });
    try {
        await connection.asPromise();
    } catch {
        await connection.close().catch(() => {});
        throw new Error(`The tests need MongoDB at ${uri}, and it did not answer. Click Install or Run to start it, then run the tests again.`);
    }
    await connection.dropDatabase();
    await connection.close();
}
