const dateKeyPattern = /^\d{4}-\d{2}-\d{2}$/;

export function isTimeZone(value) {
    try {
        new Intl.DateTimeFormat("en-US", { timeZone: value }).format();
        return true;
    } catch {
        return false;
    }
}

export function addCalendarDays(dateKey, amount) {
    if (!dateKeyPattern.test(dateKey)) throw new TypeError("Invalid calendar date.");
    const [year, month, day] = dateKey.split("-").map(Number);
    const value = new Date(Date.UTC(year, month - 1, day + amount));
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

export function dayOfWeek(dateKey) {
    const [year, month, day] = dateKey.split("-").map(Number);
    return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function partsAt(value, timeZone) {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hourCycle: "h23",
    }).formatToParts(value);
    return Object.fromEntries(parts.filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
}

export function localDateKey(value, timeZone) {
    const { year, month, day } = partsAt(value, timeZone);
    return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function workingHoursStatus(startAt, endAt, workingHours, timeZone) {
    const start = partsAt(startAt, timeZone);
    const end = partsAt(endAt, timeZone);
    const startDate = `${start.year}-${String(start.month).padStart(2, "0")}-${String(start.day).padStart(2, "0")}`;
    const endDate = `${end.year}-${String(end.month).padStart(2, "0")}-${String(end.day).padStart(2, "0")}`;
    const startMinute = start.hour * 60 + start.minute;
    const endMinute = end.hour * 60 + end.minute;
    const weekday = dayOfWeek(startDate);
    const sameDay = startDate === endDate;
    const workingDay = ![0, 6].includes(weekday);
    return {
        withinWorkingHours: sameDay && workingDay && startMinute >= workingHours.startMinute && endMinute <= workingHours.endMinute,
        localDate: startDate,
        localStartMinute: startMinute,
        localEndMinute: endMinute,
        workingDay,
    };
}

export function zonedDateTime(dateKey, minuteOfDay, timeZone) {
    const [year, month, day] = dateKey.split("-").map(Number);
    const hour = Math.floor(minuteOfDay / 60);
    const minute = minuteOfDay % 60;
    const requestedAsUtc = Date.UTC(year, month - 1, day, hour, minute);
    let result = new Date(requestedAsUtc);
    for (let iteration = 0; iteration < 3; iteration += 1) {
        const actual = partsAt(result, timeZone);
        const actualAsUtc = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute, actual.second);
        const correction = requestedAsUtc - actualAsUtc;
        if (!correction) break;
        result = new Date(result.getTime() + correction);
    }
    return result;
}
