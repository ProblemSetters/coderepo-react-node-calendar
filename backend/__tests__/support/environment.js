import { loadEnvironment, testDatabaseUri } from "./test-database.js";

// Runs before every test file, before the app's modules load, so the app reads the test settings.
loadEnvironment();
process.env.MONGODB_URI = testDatabaseUri();
process.env.JWT_SECRET = process.env.JWT_SECRET || "calendar-test-secret";
process.env.NODE_ENV = "test";
