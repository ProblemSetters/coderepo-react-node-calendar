import { z } from "zod";
import { availabilityService } from "./availability.service.js";
import { isTimeZone } from "../../shared/utils/time-zone.js";

const suggestionSchema = z.object({
    participantIds: z.array(z.string()).min(1).max(10).refine((ids) => new Set(ids).size === ids.length, "Select each person only once."),
    from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    timeZone: z.string().refine(isTimeZone, "Select a valid IANA time zone."),
    days: z.coerce.number().int().min(1).max(14).default(5),
    durationMinutes: z.coerce.number().int().min(15).max(240).refine((duration) => duration % 15 === 0, "Duration must use 15-minute increments."),
});

const conflictSchema = z.object({
    participantIds: z.array(z.string()).min(1).max(100).refine((ids) => new Set(ids).size === ids.length, "Select each person only once."),
    startAt: z.coerce.date(),
    endAt: z.coerce.date(),
}).refine((value) => value.startAt < value.endAt, { message: "endAt must be after startAt.", path: ["endAt"] });

export async function suggestTimes(request, response, next) {
    try {
        response.json({ data: await availabilityService.suggest(suggestionSchema.parse(request.body), request.profile) });
    } catch (error) {
        next(error);
    }
}

export async function checkConflicts(request, response, next) {
    try {
        response.json({ data: await availabilityService.conflicts(conflictSchema.parse(request.body)) });
    } catch (error) {
        next(error);
    }
}
