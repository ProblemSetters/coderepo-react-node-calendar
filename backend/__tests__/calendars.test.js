import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { Calendar } from "../src/features/calendars/calendar.model.js";
import { as, closeDatabase, createWorkspace, errorCode, eventBody, openDatabase, resetDatabase, signIn } from "./support/api.js";

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

describe("Calendars", () => {
    test("lists only the signed-in profile's calendars, primary first", async () => {
        const response = await alex.get("/api/v1/calendars");

        expect(response.status).toBe(200);
        expect(response.body.data.map((calendar) => [calendar.name, calendar.isPrimary])).toEqual([
            ["Alex Morgan", true],
            ["Work", false],
        ]);
    });

    test("creates, renames and recolours a calendar, and refuses a name already in use", async () => {
        const created = await alex.post("/api/v1/calendars", { name: "Projects", color: "#f4511e" });
        const renamed = await alex.patch(`/api/v1/calendars/${created.body.data._id}`, { name: "Roadmap", color: "#039be5" });
        const duplicate = await alex.post("/api/v1/calendars", { name: "work", color: "#f4511e" });

        expect(created.status).toBe(201);
        expect(renamed.status).toBe(200);
        expect(renamed.body.data).toMatchObject({ name: "Roadmap", color: "#039be5" });
        expect(duplicate.status).toBe(409);
        expect(errorCode(duplicate)).toBe("CALENDAR_NAME_CONFLICT");
    });

    test("keeps one calendar when the same name is created twice at once", async () => {
        const responses = await Promise.all([
            alex.post("/api/v1/calendars", { name: "Launch", color: "#f4511e" }),
            alex.post("/api/v1/calendars", { name: "Launch", color: "#f4511e" }),
        ]);

        expect(responses.map((response) => response.status).sort()).toEqual([201, 409]);
        expect(await Calendar.countDocuments({ ownerId: people.alex._id, name: "Launch" })).toBe(1);
    });

    test("shows only the chosen calendar when asked to display it alone", async () => {
        const response = await alex.post(`/api/v1/calendars/${calendars.alexWork._id}/display-only`);

        expect(response.status).toBe(200);
        expect(response.body.data.map((calendar) => [calendar.name, calendar.visible])).toEqual([
            ["Alex Morgan", false],
            ["Work", true],
        ]);
    });

    test("never deletes the primary calendar or one that still has events", async () => {
        const primary = await alex.delete(`/api/v1/calendars/${calendars.alexPrimary._id}`);
        const event = await alex.post("/api/v1/events", eventBody(calendars.alexWork));
        const withEvents = await alex.delete(`/api/v1/calendars/${calendars.alexWork._id}`);
        await alex.delete(`/api/v1/events/${event.body.data._id}`);
        const empty = await alex.delete(`/api/v1/calendars/${calendars.alexWork._id}`);

        expect(primary.status).toBe(409);
        expect(errorCode(primary)).toBe("PRIMARY_CALENDAR");
        expect(withEvents.status).toBe(409);
        expect(errorCode(withEvents)).toBe("CALENDAR_NOT_EMPTY");
        expect(empty.status).toBe(204);
    });

    test("keeps my calendars away from other profiles", async () => {
        const jordan = as(await signIn(people.jordan));

        const listed = await jordan.get("/api/v1/calendars");
        const renamed = await jordan.patch(`/api/v1/calendars/${calendars.alexWork._id}`, { name: "Mine now" });
        const deleted = await jordan.delete(`/api/v1/calendars/${calendars.alexWork._id}`);

        expect(listed.body.data.map((calendar) => calendar.name)).toEqual(["Jordan Smith"]);
        expect(renamed.status).toBe(404);
        expect(deleted.status).toBe(404);
        expect(errorCode(deleted)).toBe("CALENDAR_NOT_FOUND");
    });
});
