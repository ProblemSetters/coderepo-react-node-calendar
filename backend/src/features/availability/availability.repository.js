import { Event } from "../events/event.model.js";
import { Calendar } from "../calendars/calendar.model.js";

export const availabilityRepository = {
    async ownerBusy(from, to, profileId) {
        const calendarIds = profileId ? (await Calendar.find({ ownerId: profileId }, { _id: 1 }).lean()).map((calendar) => calendar._id) : [];
        return Event.find({
            $and: [{ $or: [
                { startAt: { $lt: to }, endAt: { $gt: from } },
                { "recurrence.frequency": { $in: ["daily", "weekly", "monthly", "yearly", "weekdays"] }, startAt: { $lt: to }, $or: [{ "recurrence.endType": { $ne: "until" } }, { "recurrence.until": { $gte: from } }] },
            ] }],
            type: { $ne: "workingLocation" },
            $or: [{ allDay: false }, { type: "outOfOffice" }],
            ...(profileId ? { calendarId: { $in: calendarIds } } : {}),
        }, { title: 1, description: 1, location: 1, organizer: 1, participants: 1, participantIds: 1, attendeeResponses: 1, recurrenceResponseOverrides: 1, recurrence: 1, startAt: 1, endAt: 1, allDay: 1, type: 1, color: 1, calendarId: 1 }).sort({ startAt: 1 }).lean();
    },
    async participantBusy(participantIds, from, to) {
        const calendars = await Calendar.find({ ownerId: { $in: participantIds } }, { _id: 1, ownerId: 1 }).lean();
        const calendarIds = calendars.map((calendar) => calendar._id);
        const ownerByCalendar = new Map(calendars.map((calendar) => [String(calendar._id), calendar.ownerId]));
        const events = await Event.find({
            $and: [
                { $or: [{ participantIds: { $in: participantIds } }, { calendarId: { $in: calendarIds } }] },
                { $or: [{ allDay: false }, { type: "outOfOffice" }] },
                { $or: [
                    { startAt: { $lt: to }, endAt: { $gt: from } },
                    { "recurrence.frequency": { $in: ["daily", "weekly", "monthly", "yearly", "weekdays"] }, startAt: { $lt: to }, $or: [{ "recurrence.endType": { $ne: "until" } }, { "recurrence.until": { $gte: from } }] },
                ] },
            ],
            type: { $ne: "workingLocation" },
        }, { title: 1, description: 1, location: 1, organizer: 1, participants: 1, attendeeResponses: 1, recurrenceResponseOverrides: 1, recurrence: 1, startAt: 1, endAt: 1, allDay: 1, type: 1, color: 1, participantIds: 1, calendarId: 1 }).sort({ startAt: 1 }).lean();
        return events.map((event) => ({ ...event, ownerId: ownerByCalendar.get(String(event.calendarId)) }));
    },
};
