import { Event } from "./event.model.js";

export const eventRepository = {
    findInRange: (from, to, calendarIds, profileId) => Event.find({
        startAt: { $lt: to },
        endAt: { $gt: from },
        ...(profileId ? { $or: [
            ...(calendarIds.length ? [{ calendarId: { $in: calendarIds } }] : []),
            { participantIds: profileId },
        ] } : calendarIds.length ? { calendarId: { $in: calendarIds } } : {}),
    }).sort({ startAt: 1, title: 1 }).lean(),
    findById: (id) => Event.findById(id).lean(),
    search: (query, profileId) => {
        const expression = (value) => ({ $regex: value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), $options: "i" });
        const filters = [];
        if (query.what) filters.push({ $or: [{ title: expression(query.what) }, { description: expression(query.what) }, { location: expression(query.what) }, { participants: expression(query.what) }] });
        if (query.who) filters.push({ $or: [{ organizer: expression(query.who) }, { participants: expression(query.who) }] });
        if (query.where) filters.push({ location: expression(query.where) });
        if (query.exclude) filters.push({ $nor: [{ title: expression(query.exclude) }, { description: expression(query.exclude) }, { location: expression(query.exclude) }, { organizer: expression(query.exclude) }, { participants: expression(query.exclude) }] });
        if (query.from || query.to) {
            const startAt = {};
            if (query.from) startAt.$gte = query.from;
            if (query.to) startAt.$lt = query.to;
            filters.push({ startAt });
        }
        return Event.find({
            ...(profileId ? { $or: [
                ...(query.calendarIds.length ? [{ calendarId: { $in: query.calendarIds } }] : []),
                { participantIds: profileId },
            ] } : query.calendarIds.length ? { calendarId: { $in: query.calendarIds } } : {}),
            ...(filters.length ? { $and: filters } : {}),
        }).sort({ startAt: 1, title: 1 }).limit(100).lean();
    },
    countByCalendarId: (calendarId) => Event.countDocuments({ calendarId }),
    create: (input) => Event.create(input),
    update: (id, input) => Event.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean(),
    remove: (id) => Event.findByIdAndDelete(id).lean(),
    deleteAll: () => Event.deleteMany({}),
    insertMany: (items) => Event.insertMany(items),
};
