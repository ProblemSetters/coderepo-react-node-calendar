import { Calendar } from "../calendars/calendar.model.js";
import { Event } from "../events/event.model.js";

export const insightRepository = {
    findEvents: (from, to, calendarIds) => Event.find({
        startAt: { $lt: to },
        endAt: { $gt: from },
        ...(calendarIds.length ? { calendarId: { $in: calendarIds } } : {}),
    }).sort({ startAt: 1 }).lean(),
    findCalendars: (calendarIds) => Calendar.find(calendarIds.length ? { _id: { $in: calendarIds } } : {}).lean(),
};
