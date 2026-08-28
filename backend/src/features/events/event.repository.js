import { Event } from "./event.model.js";

export const eventRepository = {
    findInRange: (from, to, calendarIds, profileId) => Event.find({
        $and: [
            { $or: [
                { startAt: { $lt: to }, endAt: { $gt: from } },
                { "recurrence.frequency": { $in: ["daily", "weekly", "monthly", "yearly", "weekdays"] }, startAt: { $lt: to }, $or: [{ "recurrence.endType": { $ne: "until" } }, { "recurrence.until": { $gte: from } }] },
            ] },
        ],
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
            const normal = {};
            if (query.from) normal.endAt = { $gt: query.from };
            if (query.to) normal.startAt = { $lt: query.to };
            const recurring = { "recurrence.frequency": { $in: ["daily", "weekly", "monthly", "yearly", "weekdays"] } };
            if (query.to) recurring.startAt = { $lt: query.to };
            if (query.from) recurring.$or = [{ "recurrence.endType": { $ne: "until" } }, { "recurrence.until": { $gte: query.from } }];
            filters.push({ $or: [normal, recurring] });
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
    respondExisting: (id, personId, status, respondedAt) => Event.findOneAndUpdate(
        { _id: id, participantIds: personId, "attendeeResponses.personId": personId },
        { $set: { "attendeeResponses.$.status": status, "attendeeResponses.$.respondedAt": respondedAt } },
        { new: true, runValidators: true },
    ).lean(),
    addResponse: (id, personId, status, respondedAt) => Event.findOneAndUpdate(
        { _id: id, participantIds: personId, "attendeeResponses.personId": { $ne: personId } },
        { $push: { attendeeResponses: { personId, status, respondedAt } } },
        { new: true, runValidators: true },
    ).lean(),
    respondAll: (id, personId, status, respondedAt) => Event.findOneAndUpdate(
        { _id: id, participantIds: personId, "attendeeResponses.personId": personId },
        [{ $set: {
            attendeeResponses: { $map: { input: "$attendeeResponses", as: "response", in: { $cond: [
                { $eq: ["$$response.personId", personId] },
                { $mergeObjects: ["$$response", { status, respondedAt }] },
                "$$response",
            ] } } },
            recurrenceResponseOverrides: { $filter: { input: "$recurrenceResponseOverrides", as: "override", cond: { $ne: ["$$override.personId", personId] } } },
        } }],
        { new: true },
    ).lean(),
    respondOccurrence: (id, personId, scope, occurrenceStartAt, status, respondedAt) => Event.findOneAndUpdate(
        { _id: id, participantIds: personId },
        [{ $set: { recurrenceResponseOverrides: { $concatArrays: [
            { $filter: { input: "$recurrenceResponseOverrides", as: "override", cond: { $not: [{ $and: [
                { $eq: ["$$override.personId", personId] },
                { $eq: ["$$override.scope", scope] },
                { $eq: ["$$override.occurrenceStartAt", occurrenceStartAt] },
            ] }] } } },
            [{ personId, scope, occurrenceStartAt, status, respondedAt }],
        ] } } }],
        { new: true },
    ).lean(),
    remove: (id) => Event.findByIdAndDelete(id).lean(),
    deleteAll: () => Event.deleteMany({}),
    insertMany: (items) => Event.insertMany(items),
};
