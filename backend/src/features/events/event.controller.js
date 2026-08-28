import { z } from "zod";
import { eventService } from "./event.service.js";
import { isTimeZone } from "../../shared/utils/time-zone.js";

const eventFields = {
    calendarId: z.string().min(1),
    title: z.string().trim().min(1).max(140),
    type: z.enum(["event", "task", "outOfOffice", "focusTime", "workingLocation", "appointmentSchedule"]),
    description: z.string().max(2000),
    location: z.string().max(250),
    organizer: z.string().trim().max(120),
    participants: z.array(z.string().trim().min(1).max(120)).max(100),
    participantIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).max(100).refine((ids) => new Set(ids).size === ids.length, "Select each person only once."),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
    allDay: z.boolean(),
    color: z.union([z.string().regex(/^#[0-9A-Fa-f]{6}$/), z.null()]).optional(),
    recurrence: z.object({
        frequency: z.enum(["none", "daily", "weekly", "monthly", "yearly", "weekdays"]),
        interval: z.number().int().min(1).max(99).default(1),
        daysOfWeek: z.array(z.number().int().min(0).max(6)).max(7).default([]),
        monthlyMode: z.enum(["ordinalWeekday", "dayOfMonth"]).default("ordinalWeekday"),
        endType: z.enum(["never", "count", "until"]).default("never"),
        count: z.number().int().min(1).max(730).nullable().default(null),
        until: z.coerce.date().nullable().default(null),
        timeZone: z.string().min(1).max(100).default("UTC"),
    }).superRefine((value, context) => {
        if (value.frequency === "weekly" && !value.daysOfWeek.length) context.addIssue({ code: "custom", message: "Choose at least one weekday.", path: ["daysOfWeek"] });
        if (value.endType === "count" && !value.count) context.addIssue({ code: "custom", message: "Enter an occurrence count.", path: ["count"] });
        if (value.endType === "until" && !value.until) context.addIssue({ code: "custom", message: "Choose an end date.", path: ["until"] });
        if (!isTimeZone(value.timeZone)) context.addIssue({ code: "custom", message: "Choose a valid time zone.", path: ["timeZone"] });
    }).optional(),
};
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
const createSchema = z.object({ ...eventFields, type: eventFields.type.default("event"), description: eventFields.description.default(""), location: eventFields.location.default(""), organizer: eventFields.organizer.default("Calendar owner"), participants: eventFields.participants.default([]), participantIds: eventFields.participantIds.default([]), allDay: eventFields.allDay.default(false) });
const updateSchema = z.object(eventFields).partial().refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");
const responseSchema = z.object({ status: z.enum(["accepted", "declined", "tentative"]), scope: z.enum(["this", "following", "all"]).optional(), occurrenceStartAt: z.coerce.date().optional() }).strict();
const listSchema = z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    calendarIds: z.preprocess((value) => (value ? String(value).split(",").filter(Boolean) : []), z.array(objectIdSchema)),
}).refine((value) => value.from < value.to, { message: "to must be after from", path: ["to"] }).refine((value) => value.to - value.from <= 370 * 86400000, { message: "Event ranges cannot exceed 370 days.", path: ["to"] });
const searchSchema = z.object({
    q: z.string().trim().max(100).optional(),
    what: z.string().trim().max(100).optional(),
    who: z.string().trim().max(100).optional(),
    where: z.string().trim().max(100).optional(),
    exclude: z.string().trim().max(100).optional(),
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    calendarIds: z.preprocess((value) => (value ? String(value).split(",").filter(Boolean) : []), z.array(objectIdSchema)),
}).transform((value) => ({ ...value, what: value.what || value.q || "" })).refine((value) => !value.from || !value.to || value.from < value.to, { message: "to must be after from", path: ["to"] });

export async function listEvents(request, response, next) {
    try { response.json({ data: await eventService.list(listSchema.parse(request.query), request.profileId) }); } catch (error) { next(error); }
}
export async function createEvent(request, response, next) {
    try { response.status(201).json({ data: await eventService.create(createSchema.parse(request.body), request.profile) }); } catch (error) { next(error); }
}
export async function searchEvents(request, response, next) {
    try { response.json({ data: await eventService.search(searchSchema.parse(request.query), request.profileId) }); } catch (error) { next(error); }
}
export async function getEvent(request, response, next) {
    try { response.json({ data: await eventService.getById(request.params.eventId, request.profileId) }); } catch (error) { next(error); }
}
export async function updateEvent(request, response, next) {
    try { response.json({ data: await eventService.update(request.params.eventId, updateSchema.parse(request.body), request.profileId) }); } catch (error) { next(error); }
}
export async function respondToEvent(request, response, next) {
    try { const input = responseSchema.parse(request.body); response.json({ data: await eventService.respond(request.params.eventId, input.status, request.profileId, input) }); } catch (error) { next(error); }
}
export async function deleteEvent(request, response, next) {
    try { await eventService.remove(request.params.eventId, request.profileId); response.status(204).send(); } catch (error) { next(error); }
}
