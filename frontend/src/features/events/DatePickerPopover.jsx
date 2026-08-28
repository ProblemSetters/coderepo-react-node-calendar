import { useEffect, useMemo, useRef, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { addDays, addMonths, dateKey, startOfMonth, startOfWeek } from "../../shared/utils/date.js";

const displayDate = (value) => new Date(`${value}T00:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });

export function DatePickerPopover({ compact = false, label, onChange, value }) {
    const [open, setOpen] = useState(false);
    const [month, setMonth] = useState(() => startOfMonth(new Date(`${value}T00:00:00`)));
    const root = useRef(null);
    const days = useMemo(() => Array.from({ length: 42 }, (_, index) => addDays(startOfWeek(startOfMonth(month)), index)), [month]);
    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
        const keyboard = (event) => { if (event.key === "Escape") setOpen(false); };
        document.addEventListener("pointerdown", close);
        document.addEventListener("keydown", keyboard);
        return () => { document.removeEventListener("pointerdown", close); document.removeEventListener("keydown", keyboard); };
    }, [open]);
    return <div className={`editor-date-picker ${compact ? "compact" : ""}`} ref={root}>
        <button aria-expanded={open} aria-haspopup="dialog" aria-label={`${label}: ${displayDate(value)}`} className={open ? "active" : ""} title={compact ? displayDate(value) : undefined} type="button" onClick={() => { if (!open) setMonth(startOfMonth(new Date(`${value}T00:00:00`))); setOpen((current) => !current); }}>{compact ? <MaterialIcon size={19}>event</MaterialIcon> : displayDate(value)}</button>
        {open && <div className="editor-date-popover" role="dialog" aria-label={`Choose ${label.toLowerCase()}`}>
            <header><strong>{month.toLocaleDateString("en-US", { month: "long", year: "numeric" })}</strong><span><button aria-label="Previous month" className="icon-button" type="button" onClick={() => setMonth(addMonths(month, -1))}><MaterialIcon size={20}>chevron_left</MaterialIcon></button><button aria-label="Next month" className="icon-button" type="button" onClick={() => setMonth(addMonths(month, 1))}><MaterialIcon size={20}>chevron_right</MaterialIcon></button></span></header>
            <div className="editor-date-grid">{"SMTWTFS".split("").map((day, index) => <span className="editor-weekday" key={`${day}-${index}`}>{day}</span>)}{days.map((day) => <button aria-label={day.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })} className={`${day.getMonth() !== month.getMonth() ? "outside" : ""} ${dateKey(day) === value ? "selected" : ""}`} key={dateKey(day)} type="button" onClick={() => { onChange(dateKey(day)); setOpen(false); }}>{day.getDate()}</button>)}</div>
        </div>}
    </div>;
}
