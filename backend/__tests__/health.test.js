import { afterAll, beforeAll, describe, expect, test } from "@jest/globals";
import { api, closeDatabase, openDatabase } from "./support/api.js";

beforeAll(openDatabase);
afterAll(closeDatabase);

describe("Health", () => {
    test("reports the database as connected", async () => {
        const response = await api().get("/api/v1/health");

        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ status: "ok", database: "connected" });
    });
});
