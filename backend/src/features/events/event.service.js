import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { calendarRepository } from "../calendars/calendar.repository.js";
import { personService } from "../people/person.service.js";
import { eventRepository } from "./event.repository.js";
import { expandEvents, isRecurring, responseForOccurrence } from "./recurrence.js";

const responseStatuses = ["needsAction", "accepted", "declined", "tentative"];

function ensureChronology(event) {
    if (new Date(event.startAt) >= new Date(event.endAt)) {
        throw new AppError(400, "INVALID_EVENT_RANGE", "The event end time must be after its start time.");
    }
}

function ensureRecurrence(event) {
    if (event.recurrence?.frequency !== "none" && event.recurrence?.endType === "until" && event.recurrence.until && new Date(event.recurrence.until) < new Date(event.startAt)) {
        throw new AppError(400, "INVALID_RECURRENCE_END", "The recurrence end date cannot be before the event starts.");
    }
}

function ensureObjectId(id, code = "EVENT_NOT_FOUND") {
    if (!mongoose.isValidObjectId(id)) {
        throw new AppError(404, code, "The requested event does not exist.");
    }
}

async function ensureCalendar(calendarId, profileId) {
    if (!mongoose.isValidObjectId(calendarId) || !(await calendarRepository.findById(calendarId, profileId))) {
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
    const ownedIds = profileId ? new Set((await calendarRepository.findOwnedIds(values.map((event) => event.calendarId), profileId)).map((calendar) => String(calendar._id))) : null;
    return values.map((event) => {
        const directoryGuests = (event.participantIds || []).map((id) => peopleById.get(String(id))).filter(Boolean);
        const directoryNames = new Set(directoryGuests.map((person) => normalizedName(person.name)));
        const responsesById = new Map((event.attendeeResponses || []).map((response) => [String(response.personId), response]));
        const responseSummary = Object.fromEntries(responseStatuses.map((status) => [status, 0]));
        for (const person of directoryGuests) responseSummary[responseForOccurrence(event, person._id)?.status || "needsAction"] += 1;
        const currentResponse = profileId && (event.participantIds || []).some((id) => String(id) === String(profileId)) ? responseForOccurrence(event, profileId) || { personId: profileId, status: "needsAction", respondedAt: null } : null;
        const legacyGuests = (event.participants || []).filter((name) => !directoryNames.has(normalizedName(name))).map((name, index) => ({
            _id: `saved-participant-${event._id}-${index}`,
            name,
            email: "",
            avatarColor: "#5f6368",
            responseStatus: "needsAction",
        }));
        return {
            ...event,
            editable: ownedIds ? ownedIds.has(String(event.calendarId)) : true,
            responseStatus: currentResponse?.status,
            respondedAt: currentResponse?.respondedAt || null,
            responseSummary,
            participantPeople: [
                ...directoryGuests.map((person) => ({ _id: person._id, name: person.name, email: person.email, avatarColor: person.avatarColor, responseStatus: responseForOccurrence(event, person._id)?.status || "needsAction" })),
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

function reconcileResponses(participantIds, previousResponses = [], reset = false) {
    const previousById = new Map(previousResponses.map((response) => [String(response.personId), response]));
    return (participantIds || []).map((personId) => {
        const previous = previousById.get(String(personId));
        if (!reset && previous) return { personId, status: previous.status, respondedAt: previous.respondedAt || null };
        return { personId, status: "needsAction", respondedAt: null };
    });
}

export const eventService = {
    async list(query, profileId) { return decorateEvents(expandEvents(await eventRepository.findInRange(query.from, query.to, query.calendarIds, profileId), query.from, query.to), profileId); },
    async search(query, profileId) {
        const events = await eventRepository.search(query, profileId);
        return decorateEvents(query.from || query.to ? expandEvents(events, query.from || new Date(0), query.to || new Date(Date.now() + 366 * 86400000)) : events, profileId);
    },
    async getById(id, profileId) {
        ensureObjectId(id);
        const event = await eventRepository.findById(id);
        const canView = event && (!profileId || event.participantIds?.some((personId) => String(personId) === String(profileId)) || await calendarRepository.findById(event.calendarId, profileId));
        if (!canView) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
        return (await decorateEvents([event], profileId))[0];
    },
    async create(input, profile) {
        await ensureCalendar(input.calendarId, profile?._id);
        const normalized = await normalizeParticipants({ ...input, ...(profile ? { organizer: profile.name } : {}) });
        normalized.attendeeResponses = reconcileResponses(normalized.participantIds);
        ensureChronology(normalized);
        ensureRecurrence(normalized);
        return (await decorateEvents([await eventRepository.create(normalized)], profile?._id))[0];
    },
    async update(id, input, profileId) {
        ensureObjectId(id);
        const existing = await eventRepository.findById(id);
        if (!existing || profileId && !(await calendarRepository.findById(existing.calendarId, profileId))) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
        let merged = { ...existing, ...input };
        if (input.calendarId) await ensureCalendar(input.calendarId, profileId);
        if ("participants" in input || "participantIds" in input) {
            merged = await normalizeParticipants(merged);
            input = { ...input, participants: merged.participants, participantIds: merged.participantIds };
        }
        const scheduleChanged = ["startAt", "endAt", "allDay", "recurrence"].some((field) => field in input);
        if (scheduleChanged || "participantIds" in input) {
            input = { ...input, attendeeResponses: reconcileResponses(merged.participantIds, existing.attendeeResponses, scheduleChanged), ...(scheduleChanged ? { recurrenceResponseOverrides: [] } : {}) };
            merged = { ...merged, attendeeResponses: input.attendeeResponses };
        }
        ensureChronology(merged);
        ensureRecurrence(merged);
        return (await decorateEvents([await eventRepository.update(id, input)], profileId))[0];
    },
    async respond(id, status, profileId, options = {}) {
        ensureObjectId(id);
        if (!profileId) throw new AppError(401, "PROFILE_REQUIRED", "Choose a profile before responding to an invitation.");
        const existing = await eventRepository.findById(id);
        if (!existing) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
        if (!(existing.participantIds || []).some((personId) => String(personId) === String(profileId))) {
            throw new AppError(403, "NOT_EVENT_ATTENDEE", "Only an invited attendee can respond to this event.");
        }
        const recurring = isRecurring(existing);
        if (!recurring && options.scope && options.scope !== "all") throw new AppError(400, "NOT_RECURRING", "Occurrence scope is available only for recurring events.");
        const scope = recurring ? options.scope || "all" : "all";
        if (scope !== "all" && !options.occurrenceStartAt) throw new AppError(400, "OCCURRENCE_REQUIRED", "Choose which occurrence should receive this response.");
        const occurrenceStartAt = options.occurrenceStartAt ? new Date(options.occurrenceStartAt) : null;
        if (recurring && occurrenceStartAt) {
            const duration = new Date(existing.endAt) - new Date(existing.startAt);
            const occurrence = expandEvents([existing], new Date(occurrenceStartAt.getTime() - 1), new Date(occurrenceStartAt.getTime() + duration + 1))
                .find((item) => new Date(item.occurrenceStartAt).getTime() === occurrenceStartAt.getTime());
            if (!occurrence) throw new AppError(400, "INVALID_OCCURRENCE", "The selected occurrence does not belong to this recurring event.");
        }
        const respondedAt = new Date();
        const attendeeId = new mongoose.Types.ObjectId(profileId);
        let updated;
        if (scope === "all") updated = await eventRepository.respondAll(id, attendeeId, status, respondedAt) || await eventRepository.addResponse(id, attendeeId, status, respondedAt);
        else updated = await eventRepository.respondOccurrence(id, attendeeId, scope, occurrenceStartAt, status, respondedAt);
        if (!updated) throw new AppError(409, "INVITATION_CHANGED", "This invitation changed before your response was saved. Refresh and try again.");
        const displayEvent = recurring && occurrenceStartAt ? expandEvents([updated], new Date(occurrenceStartAt.getTime() - 1), new Date(occurrenceStartAt.getTime() + (new Date(updated.endAt) - new Date(updated.startAt)) + 1))[0] || updated : updated;
        return (await decorateEvents([displayEvent], profileId))[0];
    },
    async remove(id, profileId) {
        ensureObjectId(id);
        const existing = await eventRepository.findById(id);
        if (!existing || profileId && !(await calendarRepository.findById(existing.calendarId, profileId))) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
        const event = await eventRepository.remove(id);
        if (!event) throw new AppError(404, "EVENT_NOT_FOUND", "The requested event does not exist.");
    },
};
