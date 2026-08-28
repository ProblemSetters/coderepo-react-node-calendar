import { personService } from "../people/person.service.js";
import { availabilityRepository } from "./availability.repository.js";
import { addCalendarDays, dayOfWeek, localDateKey, workingHoursStatus, zonedDateTime } from "../../shared/utils/time-zone.js";
import { expandEvents, responseForOccurrence } from "../events/recurrence.js";

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
const scheduledFor = (events, personId) => events.filter((event) => {
    if (String(event.ownerId || "") === String(personId)) return true;
    if (!event.participantIds.some((id) => String(id) === String(personId))) return false;
    return responseForOccurrence(event, personId)?.status !== "declined";
});
const hoursFor = (person) => person?.workingHours || OWNER_HOURS;
const zoneFor = (person, fallback) => person?.timeZone || fallback;
const publicPerson = (person, fallbackTimeZone) => ({
    _id: person._id,
    name: person.name,
    email: person.email,
    avatarColor: person.avatarColor,
    workingHours: hoursFor(person),
    timeZone: zoneFor(person, fallbackTimeZone),
});
const withinHours = (startAt, endAt, person, fallbackTimeZone) => workingHoursStatus(startAt, endAt, hoursFor(person), zoneFor(person, fallbackTimeZone));

function workingIntervals(fromDate, days, displayTimeZone, person) {
    const from = zonedDateTime(fromDate, 0, displayTimeZone);
    const to = zonedDateTime(addCalendarDays(fromDate, days), 0, displayTimeZone);
    const zone = zoneFor(person, displayTimeZone);
    const hours = hoursFor(person);
    const firstLocalDate = localDateKey(from, zone);
    const intervals = [];
    for (let offset = -1; offset <= days + 1; offset += 1) {
        const date = addCalendarDays(firstLocalDate, offset);
        if ([0, 6].includes(dayOfWeek(date))) continue;
        const startAt = zonedDateTime(date, hours.startMinute, zone);
        const endAt = zonedDateTime(date, hours.endMinute, zone);
        if (!overlaps(from, to, { startAt, endAt })) continue;
        intervals.push({
            startAt: new Date(Math.max(from.getTime(), startAt.getTime())).toISOString(),
            endAt: new Date(Math.min(to.getTime(), endAt.getTime())).toISOString(),
        });
    }
    return intervals;
}

export const availabilityService = {
    async conflicts({ participantIds, startAt, endAt, timeZone }) {
        const people = await personService.getSelected(participantIds);
        const scheduled = expandEvents(await availabilityRepository.participantBusy(participantIds, startAt, endAt), startAt, endAt);
        const conflicts = people.map((person) => ({
            person: publicPerson(person, timeZone),
            busy: clipBlocks([...person.busyBlocks, ...scheduledFor(scheduled, person._id)], startAt, endAt),
        })).filter((participant) => participant.busy.length > 0);
        const workingHoursWarnings = people.map((person) => ({
            person: publicPerson(person, timeZone),
            ...withinHours(startAt, endAt, person, timeZone),
        })).filter((warning) => !warning.withinWorkingHours);
        return {
            startAt: startAt.toISOString(),
            endAt: endAt.toISOString(),
            available: conflicts.length === 0,
            withinWorkingHours: workingHoursWarnings.length === 0,
            conflicts,
            workingHoursWarnings,
        };
    },
    async suggest({ participantIds, from: fromDate, timeZone, days, durationMinutes }, profile) {
        const people = await personService.getSelected(participantIds);
        const from = zonedDateTime(fromDate, 0, timeZone);
        const to = zonedDateTime(addCalendarDays(fromDate, days), 0, timeZone);
        let [ownerBusy, scheduled] = await Promise.all([
            availabilityRepository.ownerBusy(from, to, profile?._id),
            availabilityRepository.participantBusy(participantIds, from, to),
        ]);
        ownerBusy = expandEvents(ownerBusy, from, to);
        scheduled = expandEvents(scheduled, from, to);
        const personSchedules = people.map((person) => ({
            person: publicPerson(person, timeZone),
            workingIntervals: workingIntervals(fromDate, days, timeZone, person),
            busy: clipBlocks([...person.busyBlocks, ...scheduledFor(scheduled, person._id)], from, to),
        }));
        const owner = profile || { name: "You", workingHours: OWNER_HOURS, timeZone };
        const suggestions = [];
        for (let dayIndex = 0; dayIndex < days; dayIndex += 1) {
            const date = addCalendarDays(fromDate, dayIndex);
            for (let minute = 0; minute + durationMinutes <= 1440; minute += 30) {
                const startAt = zonedDateTime(date, minute, timeZone);
                const endAt = new Date(startAt.getTime() + durationMinutes * 60 * 1000);
                if (endAt <= new Date()) continue;
                if (!withinHours(startAt, endAt, owner, timeZone).withinWorkingHours) continue;
                if (people.some((person) => !withinHours(startAt, endAt, person, timeZone).withinWorkingHours)) continue;
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
            owner: {
                name: profile?.name || "You",
                timeZone: zoneFor(owner, timeZone),
                workingHours: hoursFor(owner),
                workingIntervals: workingIntervals(fromDate, days, timeZone, owner),
                busy: clipBlocks(ownerBusy, from, to),
            },
            participants: personSchedules,
            suggestions,
        };
    },
};
