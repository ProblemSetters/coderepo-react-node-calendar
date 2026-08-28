import mongoose from "mongoose";

const attendeeResponseSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: "Person", required: true },
    status: { type: String, enum: ["needsAction", "accepted", "declined", "tentative"], default: "needsAction", required: true },
    respondedAt: { type: Date, default: null },
}, { _id: false });

const recurrenceSchema = new mongoose.Schema({
    frequency: { type: String, enum: ["none", "daily", "weekly", "monthly", "yearly", "weekdays"], default: "none", required: true },
    interval: { type: Number, min: 1, max: 99, default: 1, required: true },
    daysOfWeek: { type: [{ type: Number, min: 0, max: 6 }], default: [] },
    monthlyMode: { type: String, enum: ["ordinalWeekday", "dayOfMonth"], default: "ordinalWeekday" },
    endType: { type: String, enum: ["never", "count", "until"], default: "never", required: true },
    count: { type: Number, min: 1, max: 730, default: null },
    until: { type: Date, default: null },
    timeZone: { type: String, default: "UTC", maxlength: 100 },
}, { _id: false });

const recurrenceResponseOverrideSchema = new mongoose.Schema({
    personId: { type: mongoose.Schema.Types.ObjectId, ref: "Person", required: true },
    occurrenceStartAt: { type: Date, required: true },
    scope: { type: String, enum: ["this", "following"], required: true },
    status: { type: String, enum: ["accepted", "declined", "tentative"], required: true },
    respondedAt: { type: Date, required: true },
}, { _id: false });

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
        attendeeResponses: {
            type: [attendeeResponseSchema],
            default: [],
            validate: {
                validator: (responses) => new Set(responses.map((response) => String(response.personId))).size === responses.length,
                message: "Each attendee can have only one response.",
            },
        },
        recurrence: { type: recurrenceSchema, default: () => ({ frequency: "none" }) },
        recurrenceResponseOverrides: { type: [recurrenceResponseOverrideSchema], default: [] },
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
