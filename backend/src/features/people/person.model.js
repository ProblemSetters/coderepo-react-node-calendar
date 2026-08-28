import mongoose from "mongoose";

const busyBlockSchema = new mongoose.Schema({
    title: { type: String, default: "Busy", maxlength: 140 },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
}, { _id: false });

const personSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    avatarColor: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
    isProfile: { type: Boolean, default: false, index: true },
    headline: { type: String, default: "", trim: true, maxlength: 120 },
    sortOrder: { type: Number, default: 0 },
    timeZone: { type: String, default: "UTC", trim: true, maxlength: 100 },
    workingHours: {
        startMinute: { type: Number, min: 0, max: 1439, default: 540 },
        endMinute: { type: Number, min: 1, max: 1440, default: 1020 },
    },
    busyBlocks: { type: [busyBlockSchema], default: [] },
}, { timestamps: true, versionKey: false });

personSchema.index({ email: 1 }, { unique: true });
personSchema.index({ name: 1 });

export const Person = mongoose.model("Person", personSchema);
