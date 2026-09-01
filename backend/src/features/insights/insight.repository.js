import { Calendar } from "../calendars/calendar.model.js";
import { Event } from "../events/event.model.js";

const ownedCalendarIds = async (calendarIds, ownerId) => {
    const owned = await Calendar.find({ ownerId }, { _id: 1 }).lean();
    const ids = owned.map((calendar) => String(calendar._id));
    if (!calendarIds.length) return ids;
    return calendarIds.filter((id) => ids.includes(String(id)));
};

export const insightRepository = {
    async findEvents(from, to, calendarIds, ownerId) {
        const scoped = ownerId ? await ownedCalendarIds(calendarIds, ownerId) : calendarIds;
        return Event.find({
            $or: [
                { startAt: { $lt: to }, endAt: { $gt: from } },
                { "recurrence.frequency": { $in: ["daily", "weekly", "monthly", "yearly", "weekdays"] }, startAt: { $lt: to }, $or: [{ "recurrence.endType": { $ne: "until" } }, { "recurrence.until": { $gte: from } }] },
            ],
            ...(ownerId || scoped.length ? { calendarId: { $in: scoped } } : {}),
        }).sort({ startAt: 1 }).lean();
    },
    async findCalendars(calendarIds, ownerId) {
        const scoped = ownerId ? await ownedCalendarIds(calendarIds, ownerId) : calendarIds;
        return Calendar.find(ownerId || scoped.length ? { _id: { $in: scoped } } : {}).lean();
    },
};
