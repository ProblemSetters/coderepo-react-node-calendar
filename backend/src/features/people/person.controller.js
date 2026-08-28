import { z } from "zod";
import { personService } from "./person.service.js";

const searchSchema = z.object({
    q: z.string().trim().max(100).default(""),
    limit: z.coerce.number().int().min(1).max(50).default(20),
});

export async function searchPeople(request, response, next) {
    try {
        const query = searchSchema.parse(request.query);
        response.json({ data: await personService.search(query.q, query.limit, request.profileId) });
    } catch (error) {
        next(error);
    }
}

export async function listProfiles(request, response, next) {
    try { response.json({ data: await personService.listProfiles() }); } catch (error) { next(error); }
}
