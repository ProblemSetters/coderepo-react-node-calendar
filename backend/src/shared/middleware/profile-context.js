import mongoose from "mongoose";
import { AppError } from "../errors/app-error.js";
import { personService } from "../../features/people/person.service.js";

export async function resolveProfileContext(request, response, next) {
    try {
        const profileId = request.get("x-calendar-profile");
        if (!profileId) return next();
        if (!mongoose.isValidObjectId(profileId)) throw new AppError(401, "INVALID_PROFILE", "Select a valid Calendar profile.");
        const profile = await personService.findProfileById(profileId);
        if (!profile) throw new AppError(401, "PROFILE_NOT_FOUND", "This Calendar profile is no longer available.");
        request.profileId = String(profile._id);
        request.profile = profile;
        next();
    } catch (error) {
        next(error);
    }
}
