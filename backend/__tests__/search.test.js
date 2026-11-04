import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { as, closeDatabase, createWorkspace, eventBody, openDatabase, resetDatabase, signIn } from "./support/api.js";

let people;
let calendars;
let alex;

beforeAll(openDatabase);
beforeEach(async () => {
    await resetDatabase();
    ({ people, calendars } = await createWorkspace());
    alex = as(await signIn(people.alex));
});
afterAll(closeDatabase);

describe("Search", () => {
    test("finds my events by title and never shows events I cannot see", async () => {
        const jordan = as(await signIn(people.jordan));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Quarterly planning" }));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Hiring sync" }));
        await jordan.post("/api/v1/events", eventBody(calendars.jordanPrimary, { title: "Quarterly budget" }));

        const response = await alex.get(`/api/v1/events/search?q=quarterly&calendarIds=${calendars.alexPrimary._id},${calendars.alexWork._id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.map((event) => event.title)).toEqual(["Quarterly planning"]);
    });

    test("finds people by name or email, leaving out the person searching", async () => {
        const byName = await alex.get("/api/v1/people?q=jor");
        const byEmail = await alex.get("/api/v1/people?q=taylor@calendar");
        const self = await alex.get("/api/v1/people?q=alex");

        expect(byName.body.data.map((person) => person.name)).toEqual(["Jordan Smith"]);
        expect(byEmail.body.data.map((person) => person.name)).toEqual(["Taylor Johnson"]);
        expect(self.body.data).toEqual([]);
    });
});
