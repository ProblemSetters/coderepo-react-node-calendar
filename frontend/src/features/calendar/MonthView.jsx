import { addDays, dateKey, formatTime, isSameDay, startOfMonth, startOfWeek } from "../../shared/utils/date.js";
import { foregroundForColor } from "./calendar-colors.js";

export function MonthView({ calendars, cursor, events, onCreate, onDaySelect, onEventSelect }) {
    const start = startOfWeek(startOfMonth(cursor));
    const dates = Array.from({ length: 42 }, (_, index) => addDays(start, index));
    const colorFor = (event) => event.color || calendars.find((calendar) => calendar._id === String(event.calendarId))?.color || "#1a73e8";
    const overlapsDate = (event, date) => { const start = new Date(date.getFullYear(), date.getMonth(), date.getDate()); return new Date(event.startAt) < addDays(start, 1) && new Date(event.endAt) > start; };
    return (
        <div className="month-view">
            <div className="month-weekdays">{["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"].map((day) => <span key={day}>{day.slice(0, 3)}</span>)}</div>
            <div className="month-grid">
                {dates.map((date) => {
                    const dayEvents = events.filter((event) => overlapsDate(event, date));
                    const shown = dayEvents.slice(0, 3);
                    return <div className={`month-cell ${date.getMonth() !== cursor.getMonth() ? "outside" : ""} ${isSameDay(date, new Date()) ? "today" : ""}`} key={dateKey(date)} onDoubleClick={(clickEvent) => { if (clickEvent.target.closest("button")) return; const startAt = new Date(date); startAt.setHours(9, 0, 0, 0); onCreate(startAt); }}>
                        <button className="month-date" aria-label={`Open ${date.toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`} onClick={() => onDaySelect(date)}>{date.getDate()}</button>
                        <div className="month-events">
                            {shown.map((event) => {
                                const time = event.allDay ? "All day" : isSameDay(event.startAt, date) ? formatTime(event.startAt) : "Continues";
                                const background = colorFor(event);
                                return <button aria-label={`${event.title}, ${time}`} key={event._id} data-item-type={event.type || "event"} className={`month-event ${event.allDay ? "all-day" : ""}`} onClick={() => onEventSelect(event)}>{event.allDay ? <span className="event-fill" style={{ backgroundColor: background, color: foregroundForColor(background) }}>{event.title}</span> : <><i style={{ backgroundColor: background }} /><span>{time}</span><strong>{event.title}</strong></>}</button>;
                            })}
                            {dayEvents.length > shown.length && <button className="more-events" onClick={() => onDaySelect(date)}>+{dayEvents.length - shown.length} more</button>}
                        </div>
                    </div>;
                })}
            </div>
        </div>
    );
}
