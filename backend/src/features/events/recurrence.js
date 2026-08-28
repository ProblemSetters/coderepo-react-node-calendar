import { addCalendarDays, dayOfWeek, localDateKey, partsAt, zonedDateTime } from "../../shared/utils/time-zone.js";

const DAY_MS = 86400000;

function dateParts(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return { year, month, day };
}

function dayDifference(from, to) {
    const first = dateParts(from);
    const second = dateParts(to);
    return Math.round((Date.UTC(second.year, second.month - 1, second.day) - Date.UTC(first.year, first.month - 1, first.day)) / DAY_MS);
}

function monthDifference(from, to) {
    const first = dateParts(from);
    const second = dateParts(to);
    return (second.year - first.year) * 12 + second.month - first.month;
}

function ordinalInMonth(dateKey) {
    const { day } = dateParts(dateKey);
    return Math.ceil(day / 7);
}

function isLastWeekdayInMonth(dateKey) {
    return dateParts(addCalendarDays(dateKey, 7)).month !== dateParts(dateKey).month;
}

function matchesDate(anchorDate, candidateDate, recurrence) {
    const days = dayDifference(anchorDate, candidateDate);
    if (days < 0) return false;
    const interval = recurrence.interval || 1;
    const weekday = dayOfWeek(candidateDate);
    if (recurrence.frequency === "daily") return days % interval === 0;
    if (recurrence.frequency === "weekdays") return ![0, 6].includes(weekday);
    if (recurrence.frequency === "weekly") {
        const week = Math.floor(days / 7);
        return week % interval === 0 && (recurrence.daysOfWeek?.length ? recurrence.daysOfWeek : [dayOfWeek(anchorDate)]).includes(weekday);
    }
    if (recurrence.frequency === "monthly") {
        const months = monthDifference(anchorDate, candidateDate);
        if (months < 0 || months % interval !== 0) return false;
        if (recurrence.monthlyMode === "dayOfMonth") return dateParts(anchorDate).day === dateParts(candidateDate).day;
        const sameWeekday = dayOfWeek(anchorDate) === weekday;
        return sameWeekday && (isLastWeekdayInMonth(anchorDate) ? isLastWeekdayInMonth(candidateDate) : ordinalInMonth(anchorDate) === ordinalInMonth(candidateDate));
    }
    if (recurrence.frequency === "yearly") {
        const anchor = dateParts(anchorDate);
        const candidate = dateParts(candidateDate);
        return candidate.year >= anchor.year && (candidate.year - anchor.year) % interval === 0 && candidate.month === anchor.month && candidate.day === anchor.day;
    }
    return false;
}

export function isRecurring(event) {
    return Boolean(event.recurrence?.frequency && event.recurrence.frequency !== "none");
}

export function occurrenceIdentity(event) {
    return event.occurrenceStartAt || event.startAt;
}

export function expandEvent(event, from, to) {
    const start = new Date(event.startAt);
    const end = new Date(event.endAt);
    if (!isRecurring(event)) return start < to && end > from ? [event] : [];
    const recurrence = event.recurrence;
    const timeZone = recurrence.timeZone || "UTC";
    const anchorDate = localDateKey(start, timeZone);
    const anchorParts = partsAt(start, timeZone);
    const anchorMinute = anchorParts.hour * 60 + anchorParts.minute;
    const duration = end.getTime() - start.getTime();
    const queryStartDate = localDateKey(new Date(Math.max(start.getTime(), from.getTime() - duration)), timeZone);
    const queryEndDate = localDateKey(to, timeZone);
    const countLimit = recurrence.endType === "count" ? recurrence.count : null;
    const until = recurrence.endType === "until" && recurrence.until ? new Date(recurrence.until) : null;
    const instances = [];
    let matched = 0;
    let date = anchorDate;
    while (date <= queryEndDate) {
        if (matchesDate(anchorDate, date, recurrence)) {
            matched += 1;
            if (countLimit && matched > countLimit) break;
            const occurrenceStart = zonedDateTime(date, anchorMinute, timeZone);
            if (until && occurrenceStart > until) break;
            const occurrenceEnd = new Date(occurrenceStart.getTime() + duration);
            if (date >= queryStartDate && occurrenceStart < to && occurrenceEnd > from) {
                instances.push({
                    ...event,
                    seriesStartAt: event.startAt,
                    seriesEndAt: event.endAt,
                    startAt: occurrenceStart,
                    endAt: occurrenceEnd,
                    recurring: true,
                    occurrenceStartAt: occurrenceStart,
                    occurrenceKey: `${event._id}:${occurrenceStart.toISOString()}`,
                });
            }
        }
        date = addCalendarDays(date, 1);
    }
    return instances;
}

export function expandEvents(events, from, to) {
    return events.flatMap((event) => expandEvent(event, from, to)).sort((first, second) => new Date(first.startAt) - new Date(second.startAt) || first.title.localeCompare(second.title));
}

export function responseForOccurrence(event, personId) {
    const base = event.attendeeResponses?.find((response) => String(response.personId) === String(personId));
    if (!event.occurrenceStartAt) return base;
    const occurrenceTime = new Date(event.occurrenceStartAt).getTime();
    const overrides = (event.recurrenceResponseOverrides || []).filter((override) => String(override.personId) === String(personId));
    const exact = overrides.find((override) => override.scope === "this" && new Date(override.occurrenceStartAt).getTime() === occurrenceTime);
    if (exact) return exact;
    return overrides.filter((override) => override.scope === "following" && new Date(override.occurrenceStartAt).getTime() <= occurrenceTime)
        .sort((first, second) => new Date(second.occurrenceStartAt) - new Date(first.occurrenceStartAt))[0] || base;
}
