import { Calendar } from "./calendar.model.js";

export const calendarRepository = {
    list: (ownerId) => Calendar.find(ownerId ? { ownerId } : {}).sort({ isPrimary: -1, name: 1 }).lean(),
    findById: (id, ownerId) => Calendar.findOne({ _id: id, ...(ownerId ? { ownerId } : {}) }).lean(),
    findByName: (name, excludedId, ownerId) => Calendar.findOne({
        name: { $regex: `^${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        ...(ownerId ? { ownerId } : {}),
        ...(excludedId ? { _id: { $ne: excludedId } } : {}),
    }).lean(),
    create: (input) => Calendar.create(input),
    update: (id, input) => Calendar.findByIdAndUpdate(id, input, { new: true, runValidators: true }).lean(),
    async displayOnly(id, ownerId) {
        const scope = ownerId ? { ownerId } : {};
        await Calendar.bulkWrite([
            { updateMany: { filter: { ...scope, _id: { $ne: id }, visible: true }, update: { $set: { visible: false } } } },
            { updateOne: { filter: { ...scope, _id: id }, update: { $set: { visible: true } } } },
        ]);
        return Calendar.find(scope).sort({ isPrimary: -1, name: 1 }).lean();
    },
    remove: (id, ownerId) => Calendar.findOneAndDelete({ _id: id, ...(ownerId ? { ownerId } : {}) }).lean(),
    deleteAll: () => Calendar.deleteMany({}),
    insertMany: (items) => Calendar.insertMany(items),
};
