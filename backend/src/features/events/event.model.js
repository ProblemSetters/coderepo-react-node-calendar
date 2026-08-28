import mongoose from "mongoose";

const eventSchema = new mongoose.Schema(
    {
        calendarId: { type: mongoose.Schema.Types.ObjectId, ref: "Calendar", required: true, index: true },
        title: { type: String, required: true, trim: true, maxlength: 140 },
        type: { type: String, enum: ["event", "task", "outOfOffice", "focusTime", "workingLocation", "appointmentSchedule"], default: "event", index: true },
        description: { type: String, default: "", maxlength: 2000 },
        location: { type: String, default: "", maxlength: 250 },
        organizer: { type: String, default: "Calendar owner", maxlength: 120 },
        participants: { type: [{ type: String, trim: true, maxlength: 120 }], default: [] },
        participantIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: "Person" }], default: [] },
        startAt: { type: Date, required: true, index: true },
        endAt: { type: Date, required: true, index: true },
        allDay: { type: Boolean, default: false },
        color: { type: String, match: /^#[0-9A-Fa-f]{6}$/ },
    },
    { timestamps: true, versionKey: false },
);

eventSchema.index({ calendarId: 1, startAt: 1, endAt: 1 });
eventSchema.index({ title: "text", description: "text", location: "text" });
export const Event = mongoose.model("Event", eventSchema);
