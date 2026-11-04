import { describe, expect, test } from "@jest/globals";
import { expandEvent } from "../src/features/events/recurrence.js";

const repeating = (startAt, endAt, recurrence) => ({ _id: "series", title: "Series", startAt: new Date(startAt), endAt: new Date(endAt), recurrence: { interval: 1, daysOfWeek: [], timeZone: "UTC", ...recurrence } });
const startsOf = (event, from, to) => expandEvent(event, new Date(from), new Date(to)).map((occurrence) => occurrence.startAt.toISOString());

describe("Repeating events", () => {
    test("a weekly repeat on chosen weekdays stops at its end date", () => {
        const series = repeating("2030-06-03T10:00:00.000Z", "2030-06-03T10:30:00.000Z", { frequency: "weekly", daysOfWeek: [1, 3], endType: "until", until: new Date("2030-06-12T00:00:00.000Z") });

        expect(startsOf(series, "2030-06-01T00:00:00.000Z", "2030-07-01T00:00:00.000Z")).toEqual([
            "2030-06-03T10:00:00.000Z",
            "2030-06-05T10:00:00.000Z",
            "2030-06-10T10:00:00.000Z",
            "2030-06-12T10:00:00.000Z",
        ]);
    });

    test("a monthly repeat on the first Monday stops after its count", () => {
        const series = repeating("2030-06-03T09:00:00.000Z", "2030-06-03T10:00:00.000Z", { frequency: "monthly", monthlyMode: "ordinalWeekday", endType: "count", count: 3 });

        expect(startsOf(series, "2030-06-01T00:00:00.000Z", "2031-01-01T00:00:00.000Z")).toEqual([
            "2030-06-03T09:00:00.000Z",
            "2030-07-01T09:00:00.000Z",
            "2030-08-05T09:00:00.000Z",
        ]);
    });

    test("a repeat keeps its local time across a daylight saving change", () => {
        const series = repeating("2030-03-04T14:00:00.000Z", "2030-03-04T15:00:00.000Z", { frequency: "weekly", endType: "never", timeZone: "America/New_York" });

        expect(startsOf(series, "2030-03-01T00:00:00.000Z", "2030-03-15T00:00:00.000Z")).toEqual([
            "2030-03-04T14:00:00.000Z",
            "2030-03-11T13:00:00.000Z",
        ]);
    });
});
