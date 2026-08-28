import { z } from "zod";
import { calendarService } from "./calendar.service.js";

const timeZone = z.string().trim().min(1).max(100).refine((value) => {
    try { new Intl.DateTimeFormat("en", { timeZone: value }).format(); return true; } catch { return false; }
}, "Provide a valid IANA time zone.");

const updateSchema = z
    .object({
        name: z.string().trim().min(1).max(80).optional(),
        color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
        description: z.string().trim().max(1000).optional(),
        timeZone: timeZone.optional(),
        visible: z.boolean().optional(),
    })
    .refine((value) => Object.keys(value).length > 0, "Provide at least one field to update.");
const createSchema = z.object({
    name: z.string().trim().min(1).max(80),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    description: z.string().trim().max(1000).default(""),
    timeZone: timeZone.default("UTC"),
});

export async function listCalendars(request, response, next) {
    try {
        response.json({ data: await calendarService.list(request.profileId) });
    } catch (error) {
        next(error);
    }
}

export async function updateCalendar(request, response, next) {
    try {
        response.json({ data: await calendarService.update(request.params.calendarId, updateSchema.parse(request.body), request.profileId) });
    } catch (error) {
        next(error);
    }
}
export async function createCalendar(request, response, next) {
    try { response.status(201).json({ data: await calendarService.create(createSchema.parse(request.body), request.profileId) }); } catch (error) { next(error); }
}
export async function deleteCalendar(request, response, next) {
    try { await calendarService.remove(request.params.calendarId, request.profileId); response.status(204).send(); } catch (error) { next(error); }
}
export async function displayOnlyCalendar(request, response, next) {
    try { response.json({ data: await calendarService.displayOnly(request.params.calendarId, request.profileId) }); } catch (error) { next(error); }
}
