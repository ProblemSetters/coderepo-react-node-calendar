import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { formatTime, formatTimeZoneOffset, startOfDay, toDateInput } from "../../shared/utils/date.js";
import { getLayeredEventGeometry, layoutTimedEvents } from "../calendar/event-layout.js";
import { foregroundForColor } from "../calendar/calendar-colors.js";
import { availabilityApi } from "./availability.api.js";

const hourHeight = 64;
const ownerHours = { startMinute: 9 * 60, endMinute: 17 * 60 + 30 };
const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();

function BusyBlocks({ blocks, color, onSelect, person }) {
    const positioned = layoutTimedEvents(blocks.map((block, index) => ({ ...block, _id: block._id || `${block.startAt}-${index}` })));
    return positioned.map(({ event, column, columns }) => {
        const start = new Date(event.startAt);
        const end = new Date(event.endAt);
        const startMinute = start.getHours() * 60 + start.getMinutes();
        const duration = Math.max(20, (end - start) / 60000);
        const geometry = getLayeredEventGeometry(column, columns);
        const background = event.color || color;
        return <button type="button" className="comparison-busy" key={event._id} style={{ backgroundColor: background, color: foregroundForColor(background), top: `${startMinute / 60 * hourHeight}px`, height: `${duration / 60 * hourHeight}px`, left: `${geometry.left}%`, width: `calc(${geometry.width}% - 6px)`, zIndex: geometry.zIndex }} title={`${event.title}: ${formatTime(event.startAt)} – ${formatTime(event.endAt)}`} aria-label={`${event.title || "Busy"}, ${formatTime(event.startAt)} to ${formatTime(event.endAt)}, ${person.name}`} onClick={(clickEvent) => { clickEvent.stopPropagation(); onSelect(event, person, color); }}>
            <strong>{event.title || "Busy"}</strong><span>{formatTime(event.startAt)} – {formatTime(event.endAt)}</span>
        </button>;
    });
}

function ScheduleColumn({ blocks, color, name, onBusySelect, onCreate, person }) {
    return <div className="comparison-column" aria-label={`${name} schedule`} onClick={(event) => {
        if (!onCreate) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        const minute = Math.max(0, Math.min(1439, (event.clientY - bounds.top) / hourHeight * 60));
        onCreate(Math.floor(minute / 15) * 15);
    }}>
        <BusyBlocks blocks={blocks} color={color} onSelect={onBusySelect} person={person} />
    </div>;
}

export function AvailabilityComparison({ cursor, onCreate, onEventSelect = () => {}, ownerColor = "#039be5", people }) {
    const [data, setData] = useState(null);
    const [status, setStatus] = useState({ loading: true, error: "" });
    const scrollReference = useRef(null);
    const requestId = useRef(0);
    const day = useMemo(() => startOfDay(cursor), [cursor]);
    const columns = useMemo(() => [{ person: { _id: "owner", name: "You", avatarColor: ownerColor, workingHours: ownerHours }, busy: data?.owner?.busy || [] }, ...(data?.participants || people.map((person) => ({ person, busy: [] })))], [data, ownerColor, people]);
    const load = useCallback(async () => {
        const currentRequest = ++requestId.current;
        setStatus({ loading: true, error: "" });
        try {
            const result = await availabilityApi.suggestions({ participantIds: people.map((person) => person._id), from: toDateInput(day), timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone, days: 1, durationMinutes: 30 });
            if (currentRequest === requestId.current) { setData(result); setStatus({ loading: false, error: "" }); }
        } catch (error) {
            if (currentRequest === requestId.current) setStatus({ loading: false, error: error.message });
        }
    }, [day, people]);
    useEffect(() => {
        const timer = window.setTimeout(load, 0);
        return () => { window.clearTimeout(timer); requestId.current += 1; };
    }, [load]);
    useEffect(() => { if (scrollReference.current) scrollReference.current.scrollTop = 7 * hourHeight; }, [cursor]);

    const minWidth = 80 + columns.length * 190;
    const createAtMinute = (minute) => {
        const startAt = new Date(day);
        startAt.setHours(Math.floor(minute / 60), minute % 60, 0, 0);
        onCreate(startAt, people);
    };
    const selectBusyEvent = (block, person, color) => onEventSelect({
        ...block,
        editable: person._id === "owner" && Boolean(block._id),
        calendarName: person._id === "owner" ? "Your calendar" : `${person.name}’s calendar`,
        color: block.color || color,
        readOnlyOwner: person._id === "owner" ? "" : person.name,
    });
    return <div className="comparison-view">
        <div className="comparison-horizontal-scroll">
            <div className="comparison-content" style={{ minWidth: `${minWidth}px` }}>
                <header className="comparison-header" style={{ gridTemplateColumns: `80px repeat(${columns.length}, minmax(190px, 1fr))` }}>
                    <div className="comparison-date"><span>{day.toLocaleDateString("en-US", { weekday: "short" })}</span><strong>{day.getDate()}</strong><small>{formatTimeZoneOffset(day)}</small></div>
                    {columns.map(({ person }) => <div className="comparison-person" key={person._id}>
                        <span className="person-avatar" style={{ backgroundColor: person.avatarColor }}>{initials(person.name)}</span>
                        <strong title={person.email || person.name}>{person.name}</strong>
                    </div>)}
                </header>
                <div className="comparison-vertical-scroll" ref={scrollReference}>
                    <div className="comparison-grid" style={{ gridTemplateColumns: `80px repeat(${columns.length}, minmax(190px, 1fr))`, height: `${24 * hourHeight}px` }}>
                        <div className="time-axis comparison-axis">{Array.from({ length: 24 }, (_, hour) => <span key={hour} style={{ top: `${hour * hourHeight - 7}px` }}>{hour === 0 ? "" : new Date(2000, 0, 1, hour).toLocaleTimeString("en-US", { hour: "numeric", hour12: true })}</span>)}</div>
                        {columns.map(({ person, busy }) => <ScheduleColumn blocks={busy} color={person.avatarColor || "#1a73e8"} hours={person.workingHours || people.find((candidate) => candidate._id === person._id)?.workingHours} key={person._id} name={person.name} onBusySelect={selectBusyEvent} onCreate={createAtMinute} person={person} />)}
                    </div>
                </div>
            </div>
        </div>
        {status.loading && <div className="comparison-status" role="status"><MaterialIcon>sync</MaterialIcon>Comparing everyone’s calendar…</div>}
        {!status.loading && status.error && <div className="comparison-status error" role="alert"><span>{status.error}</span><button onClick={load}>Retry</button></div>}
    </div>;
}
