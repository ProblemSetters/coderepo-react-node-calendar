import { addCalendarDays, dayOfWeek, isTimeZone, workingHoursStatus, zonedDateTime } from "../../src/shared/utils/time-zone.js";

describe("time-zone calendar arithmetic", () => {
    test("adds calendar days without fixed-duration drift", () => {
        expect(addCalendarDays("2026-02-28", 1)).toBe("2026-03-01");
        expect(addCalendarDays("2026-12-31", 1)).toBe("2027-01-01");
        expect(dayOfWeek("2026-08-29")).toBe(6);
    });

    test("constructs local working hours across a daylight-saving transition", () => {
        expect(zonedDateTime("2026-03-07", 9 * 60, "America/New_York").toISOString()).toBe("2026-03-07T14:00:00.000Z");
        expect(zonedDateTime("2026-03-08", 9 * 60, "America/New_York").toISOString()).toBe("2026-03-08T13:00:00.000Z");
    });

    test("validates IANA time zones", () => {
        expect(isTimeZone("Asia/Kolkata")).toBe(true);
        expect(isTimeZone("Mars/Olympus")).toBe(false);
    });

    test("evaluates local working hours in DST-aware zones and rejects weekends", () => {
        const hours = { startMinute: 9 * 60, endMinute: 17 * 60 };
        expect(workingHoursStatus(new Date("2026-03-09T13:00:00.000Z"), new Date("2026-03-09T14:00:00.000Z"), hours, "America/New_York").withinWorkingHours).toBe(true);
        expect(workingHoursStatus(new Date("2026-03-09T12:30:00.000Z"), new Date("2026-03-09T13:30:00.000Z"), hours, "America/New_York").withinWorkingHours).toBe(false);
        expect(workingHoursStatus(new Date("2026-03-08T14:00:00.000Z"), new Date("2026-03-08T15:00:00.000Z"), hours, "America/New_York").workingDay).toBe(false);
    });
});
