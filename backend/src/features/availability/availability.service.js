import { personService } from "../people/person.service.js";
import { availabilityRepository } from "./availability.repository.js";
import { addCalendarDays, dayOfWeek, zonedDateTime } from "../../shared/utils/time-zone.js";

const OWNER_HOURS = { startMinute: 9 * 60, endMinute: 17 * 60 + 30 };

const overlaps = (startAt, endAt, block) => startAt < new Date(block.endAt) && endAt > new Date(block.startAt);
const clipBlocks = (blocks, from, to) => blocks.filter((block) => overlaps(from, to, block)).map((block) => ({
    ...(block._id ? { _id: String(block._id) } : {}),
    title: block.title || "Busy",
    ...(block.calendarId ? { calendarId: String(block.calendarId) } : {}),
    ...(block.type ? { type: block.type } : {}),
    ...(block.description ? { description: block.description } : {}),
    ...(block.location ? { location: block.location } : {}),
    ...(block.organizer ? { organizer: block.organizer } : {}),
    ...(block.participants?.length ? { participants: block.participants } : {}),
    ...(block.color ? { color: block.color } : {}),
    ...(block.allDay ? { allDay: true } : {}),
    startAt: new Date(Math.max(from.getTime(), new Date(block.startAt).getTime())).toISOString(),
    endAt: new Date(Math.min(to.getTime(), new Date(block.endAt).getTime())).toISOString(),
}));
const scheduledFor = (events, personId) => events.filter((event) => String(event.ownerId || "") === String(personId) || event.participantIds.some((id) => String(id) === String(personId)));

export const availabilityService = {
    async conflicts({ participantIds, startAt, endAt }) {
        const people = await personService.getSelected(participantIds);
        const scheduled = await availabilityRepository.participantBusy(participantIds, startAt, endAt);
        const conflicts = people.map((person) => ({
            person: { _id: person._id, name: person.name, email: person.email, avatarColor: person.avatarColor },
            busy: clipBlocks([...person.busyBlocks, ...scheduledFor(scheduled, person._id)], startAt, endAt),
        })).filter((participant) => participant.busy.length > 0);
        return {
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            available: conflicts.length === 0,
            conflicts,
        };
    },
    async suggest({ participantIds, from: fromDate, timeZone, days, durationMinutes }, profile) {
        const people = await personService.getSelected(participantIds);
        const from = zonedDateTime(fromDate, 0, timeZone);
        const to = zonedDateTime(addCalendarDays(fromDate, days), 0, timeZone);
        const [ownerBusy, scheduled] = await Promise.all([
            availabilityRepository.ownerBusy(from, to, profile?._id),
            availabilityRepository.participantBusy(participantIds, from, to),
        ]);
        const personSchedules = people.map((person) => ({
            person: { _id: person._id, name: person.name, email: person.email, avatarColor: person.avatarColor },
            busy: clipBlocks([...person.busyBlocks, ...scheduledFor(scheduled, person._id)], from, to),
        }));
        const suggestions = [];
        for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
            const date = addCalendarDays(fromDate, dayIndex);
            if ([0, 6].includes(dayOfWeek(date))) continue;
            const ownerHours = profile?.workingHours || OWNER_HOURS;
            const sharedStartMinute = Math.max(ownerHours.startMinute, ...people.map((person) => person.workingHours.startMinute));
            const sharedEndMinute = Math.min(ownerHours.endMinute, ...people.map((person) => person.workingHours.endMinute));
            for (let minute = sharedStartMinute; minute + durationMinutes <= sharedEndMinute; minute += 30) {
                const startAt = zonedDateTime(date, minute, timeZone);
                const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
                if (endAt <= new Date()) continue;
                const ownerConflict = ownerBusy.some((block) => overlaps(startAt, endAt, block));
                const peopleConflict = personSchedules.some((person) => person.busy.some((block) => overlaps(startAt, endAt, block)));
                if (!ownerConflict && !peopleConflict) suggestions.push({
                    startAt: startAt.toISOString(),
                    endAt: endAt.toISOString(),
                    attendeeCount: people.length + 1,
                });
                if (suggestions.length === 12) break;
            }
            if (suggestions.length === 12) break;
        }
        return {
            from: from.toISOString(),
            to: to.toISOString(),
            durationMinutes,
            timeZone,
            owner: { name: profile?.name || "You", busy: clipBlocks(ownerBusy, from, to) },
            participants: personSchedules,
            suggestions,
        };
    },
};
