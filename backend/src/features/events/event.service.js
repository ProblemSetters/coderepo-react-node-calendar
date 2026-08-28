import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { Calendar } from "../calendars/calendar.model.js";
import { personService } from "../people/person.service.js";
import { eventRepository } from "./event.repository.js";

function ensureChronology(event) {
    if (new Date(event.startAt) >= new Date(event.endAt)) {
        throw new AppError(400, "INVALID_EVENT_RANGE", "The event end time must be after its start time.");
    }
}

function ensureObjectId(id, code = "EVENT_NOT_FOUND") {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError(404, code, "The requested event does not exist.");
    }
}

async function ensureCalendar(calendarId, profileId) {
    if (!mongoose.isValidObjectId(calendarId) || !(await Calendar.exists({ _id: calendarId, ...(profileId ? { ownerId: profileId } : {}) }))) {
        throw new AppError(422, "INVALID_CALENDAR", "The selected calendar does not exist.");
    }
}

const plainEvent = (event) => event?.toObject ? event.toObject() : event;
const normalizedName = (name) => String(name).trim().toLocaleLowerCase();

async function decorateEvents(events, profileId) {
    const values = events.map(plainEvent);
    const ids = [...new Set(values.flatMap((event) => event.participantIds || []).map(String))];
    const people = ids.length ? await personService.findExisting(ids) : [];
    const peopleById = new Map(people.map((person) => [String(person._id), person]));
    const ownedIds = profileId ? new Set((await Calendar.find({ ownerId: profileId, _id: { $in: values.map((event) => event.calendarId) } }, { _id: 1 }).lean()).map((calendar) => String(calendar._id))) : null;
    return values.map((event) => {
        const directoryGuests = (event.participantIds || []).map((id) => peopleById.get(String(id))).filter(Boolean);
        const directoryNames = new Set(directoryGuests.map((person) => normalizedName(person.name)));
        const legacyGuests = (event.participants || []).filter((name) => !directoryNames.has(normalizedName(name))).map((name, index) => ({
            _id: `saved-participant-${event._id}-${index}`,
            name,
            email: "",
            avatarColor: "#5f6368",
        }));
        return {
            ...event,
            editable: ownedIds ? ownedIds.has(String(event.calendarId)) : true,
            participantPeople: [
                ...directoryGuests.map((person) => ({ _id: person._id, name: person.name, email: person.email, avatarColor: person.avatarColor })),
                ...legacyGuests,
            ],
        };
    });
}

async function normalizeParticipants(input) {
    const selectedPeople = input.participantIds?.length ? await personService.getSelected(input.participantIds) : [];
    const selectedNames = new Set(selectedPeople.map((person) => normalizedName(person.name)));
    const legacyNames = (input.participants || []).map((name) => String(name).trim()).filter((name) => name && !selectedNames.has(normalizedName(name)));
    return { ...input, participants: [...selectedPeople.map((person) => person.name), ...legacyNames] };
}

export const eventService = {
    async list(query, profileId) { return decorateEvents(await eventRepository.findInRange(query.from, query.to, query.calendarIds, profileId), profileId); },
    async search(query, profileId) { return decorateEvents(await eventRepository.search(query, profileId), profileId); },
    async getById(id, profileId) {
        ensureObjectId(id);
        const event = await eventRepository.findById(id);
        const canView = event && (!profileId || event.participantIds?.some((personId) => String(personId) === String(profileId)) || await Calendar.exists({ _id: event.calendarId, ownerId: profileId }));
        if (!canView) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
        return (await decorateEvents([event], profileId))[0];
    },
    async create(input, profile) {
        await ensureCalendar(input.calendarId, profile?._id);
        const normalized = await normalizeParticipants({ ...input, ...(profile ? { organizer: profile.name } : {}) });
        ensureChronology(normalized);
        return (await decorateEvents([await eventRepository.create(normalized)], profile?._id))[0];
    },
    async update(id, input, profileId) {
        ensureObjectId(id);
        const existing = await eventRepository.findById(id);
        if (!existing || profileId && !(await Calendar.exists({ _id: existing.calendarId, ownerId: profileId }))) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
        let merged = { ...existing, ...input };
        if (input.calendarId) await ensureCalendar(input.calendarId, profileId);
        if (input.participants || input.participantIds) {
            merged = await normalizeParticipants(merged);
            input = { ...input, participants: merged.participants, participantIds: merged.participantIds };
        }
        ensureChronology(merged);
        return (await decorateEvents([await eventRepository.update(id, input)], profileId))[0];
    },
    async remove(id, profileId) {
        ensureObjectId(id);
        const existing = await eventRepository.findById(id);
        if (!existing || profileId && !(await Calendar.exists({ _id: existing.calendarId, ownerId: profileId }))) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
        const event = await eventRepository.remove(id);
        if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
    },
};
