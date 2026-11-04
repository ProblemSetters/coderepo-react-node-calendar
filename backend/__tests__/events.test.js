import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { as, closeDatabase, createWorkspace, errorCode, eventBody, openDatabase, resetDatabase, signIn } from "./support/api.js";

const WEEKLY = { frequency: "weekly", interval: 1, daysOfWeek: [1], endType: "never", timeZone: "UTC" };

let people;
let calendars;
let alex;
let jordan;

beforeAll(openDatabase);
beforeEach(async () => {
    await resetDatabase();
    ({ people, calendars } = await createWorkspace());
    alex = as(await signIn(people.alex));
    jordan = as(await signIn(people.jordan));
});
afterAll(closeDatabase);

const invitingJordan = (overrides = {}) => eventBody(calendars.alexWork, { participantIds: [String(people.jordan._id)], ...overrides });

describe("Events", () => {
    test("creates an event in my calendar with its guests", async () => {
        const response = await alex.post("/api/v1/events", invitingJordan());

        expect(response.status).toBe(201);
        expect(response.body.data).toMatchObject({
            title: "Design review",
            organizerPerson: { name: "Alex Morgan" },
            participantPeople: [{ name: "Jordan Smith", responseStatus: "needsAction" }],
            responseSummary: { needsAction: 1, accepted: 0, declined: 0, tentative: 0 },
        });
    });

    test("refuses an event that ends before it starts, a repeat that ends before it starts, and a bad body", async () => {
        const backwards = await alex.post("/api/v1/events", eventBody(calendars.alexWork, { endAt: "2030-06-03T09:00:00.000Z" }));
        const repeatEndsEarly = await alex.post("/api/v1/events", eventBody(calendars.alexWork, { recurrence: { ...WEEKLY, endType: "until", until: "2030-06-01T00:00:00.000Z" } }));
        const noTitle = await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "" }));

        expect([backwards.status, errorCode(backwards)]).toEqual([400, "INVALID_EVENT_RANGE"]);
        expect([repeatEndsEarly.status, errorCode(repeatEndsEarly)]).toEqual([400, "INVALID_RECURRENCE_END"]);
        expect([noTitle.status, errorCode(noTitle)]).toEqual([400, "VALIDATION_ERROR"]);
    });

    test("refuses to add an event to a calendar I do not own", async () => {
        const response = await alex.post("/api/v1/events", eventBody(calendars.jordanPrimary));

        expect(response.status).toBe(422);
        expect(errorCode(response)).toBe("INVALID_CALENDAR");
    });

    test("lists single events and every occurrence of a weekly repeat inside the range", async () => {
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Launch", startAt: "2030-06-05T15:00:00.000Z", endAt: "2030-06-05T16:00:00.000Z" }));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Standup", recurrence: WEEKLY }));
        await alex.post("/api/v1/events", eventBody(calendars.alexWork, { title: "Retro", startAt: "2030-07-01T10:00:00.000Z", endAt: "2030-07-01T11:00:00.000Z" }));

        const response = await alex.get(`/api/v1/events?from=2030-06-01T00:00:00.000Z&to=2030-06-15T00:00:00.000Z&calendarIds=${calendars.alexWork._id}`);

        expect(response.status).toBe(200);
        expect(response.body.data.map((event) => [event.title, new Date(event.startAt).toISOString()])).toEqual([
            ["Standup", "2030-06-03T10:00:00.000Z"],
            ["Launch", "2030-06-05T15:00:00.000Z"],
            ["Standup", "2030-06-10T10:00:00.000Z"],
        ]);
    });

    test("lets an invited guest open an event but not change it, and hides it from everyone else", async () => {
        const created = await alex.post("/api/v1/events", invitingJordan());
        const path = `/api/v1/events/${created.body.data._id}`;
        const taylor = as(await signIn(people.taylor));

        const guestOpens = await jordan.get(path);
        const guestEdits = await jordan.patch(path, { title: "Moved by a guest" });
        const guestDeletes = await jordan.delete(path);
        const strangerOpens = await taylor.get(path);

        expect(guestOpens.status).toBe(200);
        expect(guestOpens.body.data.editable).toBe(false);
        expect(guestEdits.status).toBe(404);
        expect(guestDeletes.status).toBe(404);
        expect(strangerOpens.status).toBe(404);
        expect(errorCode(strangerOpens)).toBe("EVENT_NOT_FOUND");
    });

    test("resets every guest's answer when the time moves, but keeps it when only the title changes", async () => {
        const created = await alex.post("/api/v1/events", invitingJordan());
        const path = `/api/v1/events/${created.body.data._id}`;
        await jordan.patch(`${path}/response`, { status: "accepted" });

        await alex.patch(path, { title: "Design review (room change)" });
        const afterRename = await jordan.get(path);
        await alex.patch(path, { startAt: "2030-06-03T14:00:00.000Z", endAt: "2030-06-03T15:00:00.000Z" });
        const afterMove = await jordan.get(path);

        expect(afterRename.body.data.responseStatus).toBe("accepted");
        expect(afterMove.body.data.responseStatus).toBe("needsAction");
    });

    test("deletes an event and treats a malformed id as not found", async () => {
        const created = await alex.post("/api/v1/events", eventBody(calendars.alexWork));
        const path = `/api/v1/events/${created.body.data._id}`;

        const deleted = await alex.delete(path);
        const afterDelete = await alex.get(path);
        const malformed = await alex.get("/api/v1/events/not-an-id");

        expect(deleted.status).toBe(204);
        expect(afterDelete.status).toBe(404);
        expect([malformed.status, errorCode(malformed)]).toEqual([404, "EVENT_NOT_FOUND"]);
    });
});
