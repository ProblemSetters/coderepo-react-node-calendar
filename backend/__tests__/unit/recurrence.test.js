import { expandEvents, responseForOccurrence } from "../../src/features/events/recurrence.js";

const event = (overrides = {}) => ({
    _id: "series-1",
    title: "Recurring review",
    startAt: new Date("2026-03-06T14:00:00.000Z"),
    endAt: new Date("2026-03-06T15:00:00.000Z"),
    recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [5], monthlyMode: "ordinalWeekday", endType: "never", timeZone: "America/New_York" },
    ...overrides,
});

describe("recurrence expansion", () => {
    test("preserves local wall time through a DST transition", () => {
        const occurrences = expandEvents([event()], new Date("2026-03-01T00:00:00Z"), new Date("2026-03-21T00:00:00Z"));
        expect(occurrences.map((item) => new Date(item.startAt).toISOString())).toEqual([
            "2026-03-06T14:00:00.000Z",
            "2026-03-13T13:00:00.000Z",
            "2026-03-20T13:00:00.000Z",
        ]);
        expect(new Set(occurrences.map((item) => item.occurrenceKey)).size).toBe(3);
    });

    test("honors count endings and weekday-only rules", () => {
        const daily = event({ startAt: new Date("2026-08-27T09:00:00Z"), endAt: new Date("2026-08-27T10:00:00Z"), recurrence: { frequency: "daily", interval: 1, endType: "count", count: 2, timeZone: "UTC" } });
        expect(expandEvents([daily], new Date("2026-08-01Z"), new Date("2026-09-10Z"))).toHaveLength(2);
        const weekdays = event({ startAt: new Date("2026-08-28T09:00:00Z"), endAt: new Date("2026-08-28T10:00:00Z"), recurrence: { frequency: "weekdays", interval: 1, endType: "never", timeZone: "UTC" } });
        expect(expandEvents([weekdays], new Date("2026-08-28Z"), new Date("2026-09-02Z")).map((item) => new Date(item.startAt).getUTCDay())).toEqual([5, 1, 2]);
    });

    test("resolves exact overrides before the latest following override and series default", () => {
        const personId = "person-1";
        const occurrence = new Date("2026-09-04T13:00:00Z");
        const recurring = event({
            occurrenceStartAt: occurrence,
            attendeeResponses: [{ personId, status: "accepted" }],
            recurrenceResponseOverrides: [
                { personId, scope: "following", occurrenceStartAt: new Date("2026-08-28T13:00:00Z"), status: "tentative" },
                { personId, scope: "this", occurrenceStartAt: occurrence, status: "declined" },
            ],
        });
        expect(responseForOccurrence(recurring, personId).status).toBe("declined");
        expect(responseForOccurrence({ ...recurring, occurrenceStartAt: new Date("2026-09-11T13:00:00Z") }, personId).status).toBe("tentative");
    });
});
