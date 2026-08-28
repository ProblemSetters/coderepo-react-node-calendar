import { Calendar } from "../calendars/calendar.model.js";
import { Event } from "../events/event.model.js";

export const insightRepository = {
    findEvents: (from, to, calendarIds) => Event.find({
        $or: [
            { startAt: { $lt: to }, endAt: { $gt: from } },
            { "recurrence.frequency": { $in: ["daily", "weekly", "monthly", "yearly", "weekdays"] }, startAt: { $lt: to }, $or: [{ "recurrence.endType": { $ne: "until" } }, { "recurrence.until": { $gte: from } }] },
        ],
        ...(calendarIds.length ? { calendarId: { $in: calendarIds } } : {}),
    }).sort({ startAt: 1 }).lean(),
    findCalendars: (calendarIds) => Calendar.find(calendarIds.length ? { _id: { $in: calendarIds } } : {}).lean(),
};
