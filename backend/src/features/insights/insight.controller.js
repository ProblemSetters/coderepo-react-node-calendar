import { z } from "zod";
import { insightService } from "./insight.service.js";

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/);
const dailyInsightSchema = z.object({
    from: z.coerce.date(),
    to: z.coerce.date(),
    calendarIds: z.preprocess((value) => value ? String(value).split(",").filter(Boolean) : [], z.array(objectIdSchema)),
}).refine((value) => value.from < value.to, { message: "to must be after from", path: ["to"] });

export async function getDailyInsight(request, response, next) {
    try {
        response.json({ data: await insightService.daily(dailyInsightSchema.parse(request.query), request.profileId) });
    } catch (error) {
        next(error);
    }
}
