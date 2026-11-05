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

    test("narrows a search by place and dates, leaves out excluded words, and finds a repeat inside the dates", async () => {
        const at = (day, hour) => ({ startAt: `2030-06-${day}T${hour}:00:00.000Z`, endAt: `2030-06-${day}T${hour}:30:00.000Z` });
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Roadmap review", location: "Room 4", ...at("04", 10) }));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Roadmap review draft", location: "Room 4", ...at("05", 10) }));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Roadmap review", location: "Online", ...at("06", 10) }));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Roadmap review", location: "Room 4", ...at("20", 10) }));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Roadmap sync", location: "Room 4", startAt: "2030-05-06T09:00:00.000Z", endAt: "2030-05-06T09:30:00.000Z", recurrence: { frequency: "weekly", daysOfWeek: [1], endType: "never", timeZone: "UTC" } }));

        const response = await alex.get(`/api/v1/events/search?q=roadmap&where=room%204&exclude=draft&from=2030-06-01T00:00:00.000Z&to=2030-06-08T00:00:00.000Z&calendarIds=${calendars.alexPrimary._id},${calendars.alexWork._id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.map((event) => [event.title, new Date(event.startAt).toISOString()]).sort()).toEqual([
            ["Roadmap review", "2030-06-04T10:00:00.000Z"],
            ["Roadmap sync", "2030-06-03T09:00:00.000Z"],
        ]);
    });
});
