import { Person } from "./person.model.js";

const escapeExpression = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export const personRepository = {
    search(query, limit, excludedId) {
        const searchFilter = query ? { $or: [
            { name: { $regex: escapeExpression(query), $options: "i" } },
            { email: { $regex: escapeExpression(query), $options: "i" } },
        ] } : {};
        const filter = { ...searchFilter, ...(excludedId ? { _id: { $ne: excludedId } } : {}) };
        return Person.find(filter, { busyBlocks: 0 }).sort({ name: 1, email: 1 }).limit(limit).lean();
    },
    findByIds: (ids) => Person.find({ _id: { $in: ids } }).lean(),
    findProfileById: (id) => Person.findOne({ _id: id, isProfile: true }, { busyBlocks: 0 }).lean(),
    listProfiles: () => Person.find({ isProfile: true }, { busyBlocks: 0 }).sort({ sortOrder: 1, name: 1 }).lean(),
};
