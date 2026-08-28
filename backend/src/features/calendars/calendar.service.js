import { AppError } from "../../shared/errors/app-error.js";
import mongoose from "mongoose";
import { eventRepository } from "../events/event.repository.js";
import { calendarRepository } from "./calendar.repository.js";

function ensureId(id) {
    if (!mongoose.isValidObjectId(id)) throw new AppError(404, "CALENDAR_NOT_FOUND", "The requested calendar does not exist.");
}

async function ensureUniqueName(name, excludedId, ownerId) {
    if (name && await calendarRepository.findByName(name, excludedId, ownerId)) {
        throw new AppError(409, "CALENDAR_NAME_CONFLICT", "A calendar with this name already exists.");
    }
}

export const calendarService = {
    list: (ownerId) => calendarRepository.list(ownerId),
    async displayOnly(id, ownerId) {
        ensureId(id);
        if (!await calendarRepository.findById(id, ownerId)) throw new AppError(404, "CALENDAR_NOT_FOUND", "The requested calendar does not exist.");
        return calendarRepository.displayOnly(id, ownerId);
    },
    async create(input, ownerId) {
        await ensureUniqueName(input.name, undefined, ownerId);
        try { return await calendarRepository.create({ ...input, defaultColor: input.color, ...(ownerId ? { ownerId } : {}), visible: true, isPrimary: false }); }
        catch (error) {
            if (error?.code === 11000) throw new AppError(409, "CALENDAR_NAME_CONFLICT", "A calendar with this name already exists.");
            throw error;
        }
    },
    async update(id, input, ownerId) {
        ensureId(id);
        await ensureUniqueName(input.name, id, ownerId);
        if (!await calendarRepository.findById(id, ownerId)) throw new AppError(404, "CALENDAR_NOT_FOUND", "The requested calendar does not exist.");
        let calendar;
        try { calendar = await calendarRepository.update(id, input); }
        catch (error) {
            if (error?.code === 11000) throw new AppError(409, "CALENDAR_NAME_CONFLICT", "A calendar with this name already exists.");
            throw error;
        }
        if (!calendar) throw new AppError(404, "CALENDAR_NOT_FOUND", "The requested calendar does not exist.");
        return calendar;
    },
    async remove(id, ownerId) {
        ensureId(id);
        const calendar = await calendarRepository.findById(id, ownerId);
        if (!calendar) throw new AppError(404, "CALENDAR_NOT_FOUND", "The requested calendar does not exist.");
        if (calendar.isPrimary) throw new AppError(409, "PRIMARY_CALENDAR", "The primary calendar cannot be deleted.");
        const eventCount = await eventRepository.countByCalendarId(id);
        if (eventCount) throw new AppError(409, "CALENDAR_NOT_EMPTY", "Move or delete this calendar's events before deleting it.", { eventCount });
        await calendarRepository.remove(id, ownerId);
    },
};
