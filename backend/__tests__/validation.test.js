import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
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

const repeating = (overrides) => eventBody(calendars.alexWork, { recurrence: { frequency: "weekly", daysOfWeek: [1], endType: "never", timeZone: "UTC", ...overrides } });

describe("Input rules", () => {
    test("refuses bad colours, time zones and repeat settings, empty updates and over-long ranges, and saves nothing", async () => {
        const saved = await alex.post("/api/v1/events", eventBody(calendars.alexWork));
        const eventPath = `/api/v1/events/${saved.body.data._id}`;

        const attempts = {
            eventColour: await alex.post("/api/v1/events", eventBody(calendars.alexWork, { color: "#12345" })),
            weeklyWithoutDays: await alex.post("/api/v1/events", repeating({ daysOfWeek: [] })),
            countWithoutNumber: await alex.post("/api/v1/events", repeating({ endType: "count" })),
            untilWithoutDate: await alex.post("/api/v1/events", repeating({ endType: "until" })),
            repeatTimeZone: await alex.post("/api/v1/events", repeating({ timeZone: "Mars/Olympus" })),
            emptyEventUpdate: await alex.patch(eventPath, {}),
            rangeOverLimit: await alex.get(`/api/v1/events?from=2030-01-01T00:00:00.000Z&to=2031-01-10T00:00:00.000Z&calendarIds=${calendars.alexWork._id}`),
            calendarColour: await alex.post("/api/v1/calendars", { name: "Side projects", color: "green" }),
            calendarTimeZone: await alex.post("/api/v1/calendars", { name: "Side projects", color: "#0b8043", timeZone: "Mars/Olympus" }),
            emptyCalendarUpdate: await alex.patch(`/api/v1/calendars/${calendars.alexWork._id}`, {}),
        };
        const events = await alex.get(`/api/v1/events?from=2030-06-01T00:00:00.000Z&to=2030-07-01T00:00:00.000Z&calendarIds=${calendars.alexWork._id}`);
        const myCalendars = await alex.get("/api/v1/calendars");

        const outcome = Object.fromEntries(Object.entries(attempts).map(([name, response]) => [name, [response.status, errorCode(response)]]));
        expect(outcome).toEqual(Object.fromEntries(Object.keys(attempts).map((name) => [name, [400, "VALIDATION_ERROR"]])));
        expect(events.body.data.map((event) => event.title)).toEqual(["Design review"]);
        expect(myCalendars.body.data.map((calendar) => calendar.name)).toEqual(["Alex Morgan", "Work"]);
    });
});
