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

async function inviteJordan(overrides = {}) {
    const response = await alex.post("/api/v1/events", eventBody(calendars.alexWork, { participantIds: [String(people.jordan._id)], ...overrides }));
    return response.body.data._id;
}

describe("Invitation responses", () => {
    test("an invited guest answers and the summary counts it, while anyone else is refused", async () => {
        const eventId = await inviteJordan();

        const answered = await jordan.patch(`/api/v1/events/${eventId}/response`, { status: "accepted" });
        const organizer = await alex.patch(`/api/v1/events/${eventId}/response`, { status: "accepted" });

        expect(answered.status).toBe(200);
        expect(answered.body.data.responseSummary).toEqual({ needsAction: 0, accepted: 1, declined: 0, tentative: 0 });
        expect(organizer.status).toBe(403);
        expect(errorCode(organizer)).toBe("NOT_EVENT_ATTENDEE");
    });

    test("an answer for one occurrence of a repeat changes only that occurrence", async () => {
        const eventId = await inviteJordan({ recurrence: WEEKLY });

        const answered = await jordan.patch(`/api/v1/events/${eventId}/response`, { status: "declined", scope: "this", occurrenceStartAt: "2030-06-10T10:00:00.000Z" });
        const listed = await jordan.get("/api/v1/events?from=2030-06-01T00:00:00.000Z&to=2030-06-20T00:00:00.000Z");

        expect(answered.status).toBe(200);
        expect(listed.body.data.map((event) => [new Date(event.startAt).toISOString(), event.responseStatus])).toEqual([
            ["2030-06-03T10:00:00.000Z", "needsAction"],
            ["2030-06-10T10:00:00.000Z", "declined"],
            ["2030-06-17T10:00:00.000Z", "needsAction"],
        ]);
    });

    test("rejects occurrence choices that do not fit the event", async () => {
        const singleId = await inviteJordan();
        const repeatId = await inviteJordan({ title: "Weekly sync", recurrence: WEEKLY });

        const onSingle = await jordan.patch(`/api/v1/events/${singleId}/response`, { status: "accepted", scope: "this", occurrenceStartAt: "2030-06-03T10:00:00.000Z" });
        const noOccurrence = await jordan.patch(`/api/v1/events/${repeatId}/response`, { status: "accepted", scope: "this" });
        const notInSeries = await jordan.patch(`/api/v1/events/${repeatId}/response`, { status: "accepted", scope: "this", occurrenceStartAt: "2030-06-11T10:00:00.000Z" });

        expect([onSingle.status, errorCode(onSingle)]).toEqual([400, "NOT_RECURRING"]);
        expect([noOccurrence.status, errorCode(noOccurrence)]).toEqual([400, "OCCURRENCE_REQUIRED"]);
        expect([notInSeries.status, errorCode(notInSeries)]).toEqual([400, "INVALID_OCCURRENCE"]);
    });
});
