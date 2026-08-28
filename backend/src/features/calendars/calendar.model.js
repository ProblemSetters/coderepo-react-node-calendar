import mongoose from "mongoose";

const calendarSchema = new mongoose.Schema(
    {
        ownerId: { type: mongoose.Schema.Types.ObjectId, ref: "Person", index: true },
        name: { type: String, required: true, trim: true, minlength: 1, maxlength: 80 },
        color: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/ },
        defaultColor: { type: String, required: true, match: /^#[0-9A-Fa-f]{6}$/, default() { return this.color; } },
        description: { type: String, default: "", trim: true, maxlength: 1000 },
        timeZone: { type: String, default: "UTC", trim: true, maxlength: 100 },
        visible: { type: Boolean, default: true },
        isPrimary: { type: Boolean, default: false },
    },
    { timestamps: true, versionKey: false },
);

calendarSchema.index({ ownerId: 1, name: 1 }, { unique: true, collation: { locale: "en", strength: 2 } });

export const Calendar = mongoose.model("Calendar", calendarSchema);
