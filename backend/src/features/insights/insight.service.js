import { insightRepository } from "./insight.repository.js";
import { expandEvents } from "../events/recurrence.js";

const dayMilliseconds = 24 * 60 * 60 * 1000;
const workingDayMinutes = 8 * 60;
const trackedTypes = new Set(["event", "appointmentSchedule", "focusTime", "task", "outOfOffice"]);

function clippedMinutes(event, from, to) {
    if (!trackedTypes.has(event.type)) return 0;
    if (event.allDay) return event.type === "outOfOffice" ? workingDayMinutes : 0;
    const start = Math.max(new Date(event.startAt).getTime(), from.getTime());
    const end = Math.min(new Date(event.endAt).getTime(), to.getTime());
    return Math.max(0, Math.round((end - start) / 60000));
}

function categoryFor(type) {
    if (type === "event" || type === "appointmentSchedule") return "meetings";
    if (type === "focusTime") return "focus";
    if (type === "task") return "tasks";
    if (type === "outOfOffice") return "outOfOffice";
    return null;
}

const categoryMetadata = [
    { key: "meetings", label: "Meetings", color: "#1a73e8" },
    { key: "focus", label: "Focus time", color: "#039be5" },
    { key: "tasks", label: "Tasks", color: "#7e57c2" },
    { key: "outOfOffice", label: "Out of office", color: "#f4511e" },
];

export const insightService = {
    async daily({ from, to, calendarIds }) {
        const historyFrom = new Date(from.getTime() - 6 * dayMilliseconds);
        let [events, calendars] = await Promise.all([
            insightRepository.findEvents(historyFrom, to, calendarIds),
            insightRepository.findCalendars(calendarIds),
        ]);
        events = expandEvents(events, historyFrom, to);
        const calendarLookup = new Map(calendars.map((calendar) => [String(calendar._id), calendar]));
        const categoryMinutes = Object.fromEntries(categoryMetadata.map(({ key }) => [key, 0]));
        const calendarMinutes = new Map();
        let meetingCount = 0;

        for (const event of events) {
            const minutes = clippedMinutes(event, from, to);
            const category = categoryFor(event.type);
            if (!minutes || !category) continue;
            categoryMinutes[category] += minutes;
            if (category === "meetings") meetingCount += 1;
            const calendarId = String(event.calendarId);
            calendarMinutes.set(calendarId, (calendarMinutes.get(calendarId) || 0) + minutes);
        }

        let historicalMeetingMinutes = 0;
        for (let index = 0; index < 7; index += 1) {
            const dayStart = new Date(historyFrom.getTime() + index * dayMilliseconds);
            const dayEnd = new Date(dayStart.getTime() + dayMilliseconds);
            historicalMeetingMinutes += events.reduce((total, event) => categoryFor(event.type) === "meetings" ? total + clippedMinutes(event, dayStart, dayEnd) : total, 0);
        }

        const totalScheduledMinutes = Object.values(categoryMinutes).reduce((total, minutes) => total + minutes, 0);
        return {
            date: from.toISOString(),
            workingDayMinutes,
            totalScheduledMinutes,
            meetingMinutes: categoryMinutes.meetings,
            meetingCount,
            averageDailyMeetingMinutes: Math.round(historicalMeetingMinutes / 7),
            remainingMinutes: Math.max(0, workingDayMinutes - Math.min(workingDayMinutes, totalScheduledMinutes)),
            categories: categoryMetadata.map((metadata) => ({ ...metadata, minutes: categoryMinutes[metadata.key] })),
            calendars: [...calendarMinutes.entries()].map(([calendarId, minutes]) => {
                const calendar = calendarLookup.get(calendarId);
                return { calendarId, name: calendar?.name || "Calendar", color: calendar?.color || "#5f6368", minutes };
            }).sort((first, second) => second.minutes - first.minutes || first.name.localeCompare(second.name)),
        };
    },
};
