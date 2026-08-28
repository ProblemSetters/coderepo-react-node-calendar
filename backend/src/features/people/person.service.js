import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { personRepository } from "./person.repository.js";

export const personService = {
    search: (query, limit, excludedId) => personRepository.search(query, limit, excludedId),
    listProfiles: () => personRepository.listProfiles(),
    findProfileById: (id) => personRepository.findProfileById(id),
    findExisting: (ids) => personRepository.findByIds(ids),
    async getSelected(ids) {
        if (ids.some((id) => !mongoose.isValidObjectId(id))) {
            throw new AppError(400, "INVALID_PERSON_ID", "Every participant identifier must be valid.");
        }
        const people = await personRepository.findByIds(ids);
        if (people.length !== ids.length) {
            throw new AppError(404, "PEOPLE_NOT_FOUND", "One or more selected people no longer exist.");
        }
        const byId = new Map(people.map((person) => [String(person._id), person]));
        return ids.map((id) => byId.get(id));
    },
};
