import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { as, closeDatabase, createWorkspace, errorCode, eventBody, openDatabase, resetDatabase, signIn } from "./support/api.js";

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

const conflictsFor = (startAt, endAt) => alex.post("/api/v1/availability/conflicts", { participantIds: [String(people.jordan._id)], startAt, endAt, timeZone: "UTC" });
const suggestions = (overrides = {}) => alex.post("/api/v1/availability/suggestions", { participantIds: [String(people.jordan._id)], from: "2030-06-03", timeZone: "UTC", days: 1, durationMinutes: 60, ...overrides });

describe("Availability", () => {
    test("marks a time busy when a guest has their own event or an invitation then, but not a declined one", async () => {
        const taylor = as(await signIn(people.taylor));
        const inviteJordan = (overrides) => taylor.post("/api/v1/events", eventBody(calendars.taylorPrimary, { participantIds: [String(people.jordan._id)], ...overrides }));
        await jordan.post("/api/v1/events", eventBody(calendars.jordanPrimary, { title: "Dentist" }));
        await inviteJordan({ title: "Planning", startAt: "2030-06-03T13:00:00.000Z", endAt: "2030-06-03T14:00:00.000Z" });
        const declined = await inviteJordan({ title: "Optional demo", startAt: "2030-06-03T15:00:00.000Z", endAt: "2030-06-03T16:00:00.000Z" });
        await jordan.patch(`/api/v1/events/${declined.body.data._id}/response`, { status: "declined" });

        const ownEvent = await conflictsFor("2030-06-03T10:00:00.000Z", "2030-06-03T11:00:00.000Z");
        const invited = await conflictsFor("2030-06-03T13:00:00.000Z", "2030-06-03T14:00:00.000Z");
        const declinedSlot = await conflictsFor("2030-06-03T15:00:00.000Z", "2030-06-03T16:00:00.000Z");
        const late = await conflictsFor("2030-06-03T20:00:00.000Z", "2030-06-03T21:00:00.000Z");
        const busyTitles = (response) => response.body.data.conflicts.map((conflict) => [conflict.person.name, conflict.busy.map((block) => block.title)]);

        expect(busyTitles(ownEvent)).toEqual([["Jordan Smith", ["Dentist"]]]);
        expect(busyTitles(invited)).toEqual([["Jordan Smith", ["Planning"]]]);
        expect(declinedSlot.body.data).toMatchObject({ available: true, withinWorkingHours: true });
        expect(late.body.data).toMatchObject({ available: true, withinWorkingHours: false });
    });

    test("suggests times inside everyone's working hours that avoid their events", async () => {
        await jordan.post("/api/v1/events", eventBody(calendars.jordanPrimary, { title: "Workshop", startAt: "2030-06-03T09:00:00.000Z", endAt: "2030-06-03T12:00:00.000Z" }));

        const response = await suggestions();
        const slots = response.body.data.suggestions;

        expect(response.status).toBe(200);
        expect(slots.length).toBeGreaterThan(0);
        expect(slots[0].startAt).toBe("2030-06-03T12:00:00.000Z");
        for (const slot of slots) {
            expect(slot.startAt >= "2030-06-03T12:00:00.000Z").toBe(true);
            expect(slot.endAt <= "2030-06-03T17:00:00.000Z").toBe(true);
        }
    });

    test("checks the rules for a suggestion request", async () => {
        const oddDuration = await suggestions({ durationMinutes: 20 });
        const tooManyDays = await suggestions({ days: 15 });
        const samePersonTwice = await suggestions({ participantIds: [String(people.jordan._id), String(people.jordan._id)] });

        for (const response of [oddDuration, tooManyDays, samePersonTwice]) {
            expect([response.status, errorCode(response)]).toEqual([400, "VALIDATION_ERROR"]);
        }
    });

    test("never suggests a time that has passed, and cuts an event that started earlier to the asked time", async () => {
        await jordan.post("/api/v1/events", eventBody(calendars.jordanPrimary, { title: "Workshop", startAt: "2030-06-03T09:00:00.000Z", endAt: "2030-06-03T11:00:00.000Z" }));

        const past = await suggestions({ from: "2020-06-01" });
        const overlapping = await conflictsFor("2030-06-03T10:30:00.000Z", "2030-06-03T11:30:00.000Z");

        expect(past.status).toBe(200);
        expect(past.body.data.suggestions).toEqual([]);
        expect(overlapping.body.data.available).toBe(false);
        expect(overlapping.body.data.conflicts.map((conflict) => conflict.busy.map((block) => [block.title, block.startAt, block.endAt]))).toEqual([
            [["Workshop", "2030-06-03T10:30:00.000Z", "2030-06-03T11:00:00.000Z"]],
        ]);
    });
});
