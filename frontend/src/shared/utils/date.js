const pad = (value) => String(value).padStart(2, "0");

export function startOfDay(value) {
    const date = new Date(value);
    date.setHours(0, 0, 0, 0);
    return date;
}

export function addDays(value, amount) {
    const date = new Date(value);
    date.setDate(date.getDate() + amount);
    return date;
}

export function startOfWeek(value) {
    const date = startOfDay(value);
    return addDays(date, -date.getDay());
}

export function startOfMonth(value) {
    return new Date(value.getFullYear(), value.getMonth(), 1);
}

export function addMonths(value, amount) {
    return new Date(value.getFullYear(), value.getMonth() + amount, 1);
}

export function getViewRange(view, cursor) {
    if (view === "day") return [startOfDay(cursor), addDays(startOfDay(cursor), 1)];
    if (view === "week") return [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)];
    if (view === "month") return [startOfWeek(startOfMonth(cursor)), addDays(startOfWeek(startOfMonth(cursor)), 42)];
    return [startOfWeek(cursor), addDays(startOfWeek(cursor), 7)];
}

export function moveCursor(view, cursor, direction) {
    if (view === "day") return addDays(cursor, direction);
    if (view === "week") return addDays(cursor, direction * 7);
    if (view === "month") return addMonths(cursor, direction);
    return cursor;
}

export function formatHeading(view, cursor) {
    const options = { month: "long", year: "numeric" };
    if (view === "day") return cursor.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (view === "week") {
        const start = startOfWeek(cursor);
        const end = addDays(start, 6);
        if (start.getMonth() === end.getMonth()) return cursor.toLocaleDateString("en-US", options);
        return `${start.toLocaleDateString("en-US", { month: "short" })} – ${end.toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
    }
    return cursor.toLocaleDateString("en-US", options);
}

export function formatTimeZoneOffset(value = new Date()) {
    const offset = -new Date(value).getTimezoneOffset();
    const sign = offset >= 0 ? "+" : "-";
    const absolute = Math.abs(offset);
    return `GMT${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

export function dateKey(value) {
    const date = new Date(value);
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toDateInput(value) {
    return dateKey(value);
}

export function roundToNextHalfHour(value = new Date()) {
    const date = new Date(value);
    date.setSeconds(0, 0);
    const minutes = date.getMinutes();
    date.setMinutes(minutes < 30 ? 30 : 60);
    return date;
}

export function isSameDay(left, right) {
    return dateKey(left) === dateKey(right);
}

export function formatTime(value) {
    return new Date(value).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true });
}

export function eventDefaults(cursor, requestedStart) {
    const selected = new Date(cursor);
    const now = new Date();
    const base = isSameDay(selected, now) ? now : new Date(selected.setHours(9, 0, 0, 0));
    const start = requestedStart ? new Date(requestedStart) : roundToNextHalfHour(base);
    const end = new Date(start.getTime() + 60 * 60 * 1000);
    return { startAt: start, endAt: end, allDay: false };
}
