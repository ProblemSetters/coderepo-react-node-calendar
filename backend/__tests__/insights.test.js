import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { as, closeDatabase, createWorkspace, eventBody, openDatabase, resetDatabase, signIn } from "./support/api.js";

const DAY = "from=2030-06-03T00:00:00.000Z&to=2030-06-04T00:00:00.000Z";

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

const add = (overrides) => alex.post("/api/v1/events", eventBody(calendars.alexWork, overrides));
const minutesBy = (insight) => Object.fromEntries(insight.categories.map((category) => [category.key, category.minutes]));

describe("Daily insights", () => {
    test("adds up the day's meetings, focus time and tasks against an eight-hour day", async () => {
        await add({ title: "Design review", type: "event", startAt: "2030-06-03T10:00:00.000Z", endAt: "2030-06-03T11:00:00.000Z" });
        await add({ title: "Deep work", type: "focusTime", startAt: "2030-06-03T13:00:00.000Z", endAt: "2030-06-03T15:00:00.000Z" });
        await add({ title: "Send notes", type: "task", startAt: "2030-06-03T16:00:00.000Z", endAt: "2030-06-03T16:30:00.000Z" });

        const response = await alex.get(`/api/v1/insights/daily?${DAY}`);
        const insight = response.body.data;

        expect(response.status).toBe(200);
        expect(insight).toMatchObject({ meetingMinutes: 60, meetingCount: 1, totalScheduledMinutes: 210, remainingMinutes: 270 });
        expect(minutesBy(insight)).toEqual({ meetings: 60, focus: 120, tasks: 30, outOfOffice: 0 });
    });

    test("counts an all-day out of office as a full working day and other all-day events as nothing", async () => {
        await add({ title: "Holiday", type: "outOfOffice", allDay: true, startAt: "2030-06-03T00:00:00.000Z", endAt: "2030-06-04T00:00:00.000Z" });
        await add({ title: "Conference", type: "event", allDay: true, startAt: "2030-06-03T00:00:00.000Z", endAt: "2030-06-04T00:00:00.000Z" });

        const insight = (await alex.get(`/api/v1/insights/daily?${DAY}`)).body.data;

        expect(minutesBy(insight)).toEqual({ meetings: 0, focus: 0, tasks: 0, outOfOffice: 480 });
        expect(insight.remainingMinutes).toBe(0);
    });
});
