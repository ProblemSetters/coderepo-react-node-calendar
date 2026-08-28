import { useMemo, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { SelectMenu } from "../../shared/components/SelectMenu.jsx";

const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const shortWeekdays = ["S", "M", "T", "W", "T", "F", "S"];
const defaultRule = (timeZone) => ({ frequency: "none", interval: 1, daysOfWeek: [], monthlyMode: "ordinalWeekday", endType: "never", count: null, until: null, timeZone });

function ordinalWeekday(date) {
    const ordinal = Math.ceil(date.getDate() / 7);
    const nextWeek = new Date(date);
    nextWeek.setDate(date.getDate() + 7);
    const label = nextWeek.getMonth() !== date.getMonth() ? "last" : ["first", "second", "third", "fourth", "fifth"][ordinal - 1];
    return `${label} ${weekdays[date.getDay()]}`;
}

export function recurrenceLabel(rule, startAt) {
    const date = new Date(startAt);
    if (!rule || rule.frequency === "none") return "Does not repeat";
    if (rule.frequency === "daily") return rule.interval === 1 ? "Daily" : `Every ${rule.interval} days`;
    if (rule.frequency === "weekdays") return "Every weekday (Monday to Friday)";
    if (rule.frequency === "weekly") return rule.interval === 1 && rule.daysOfWeek?.length === 1 ? `Weekly on ${weekdays[rule.daysOfWeek[0]]}` : `Every ${rule.interval} week${rule.interval === 1 ? "" : "s"}`;
    if (rule.frequency === "monthly") return rule.interval === 1 ? `Monthly on the ${rule.monthlyMode === "dayOfMonth" ? date.getDate() : ordinalWeekday(date)}` : `Every ${rule.interval} months`;
    if (rule.frequency === "yearly") return rule.interval === 1 ? `Annually on ${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}` : `Every ${rule.interval} years`;
    return "Custom";
}

export function RepeatSelector({ startAt, value, onChange }) {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const date = new Date(startAt);
    const normalized = value || defaultRule(timeZone);
    const [customOpen, setCustomOpen] = useState(false);
    const [custom, setCustom] = useState(normalized.frequency === "none" ? { ...defaultRule(timeZone), frequency: "weekly", daysOfWeek: [date.getDay()] } : normalized);
    const presets = useMemo(() => [
        { value: "none", label: "Does not repeat", rule: defaultRule(timeZone) },
        { value: "daily", label: "Daily", rule: { ...defaultRule(timeZone), frequency: "daily" } },
        { value: "weekly", label: `Weekly on ${weekdays[date.getDay()]}`, rule: { ...defaultRule(timeZone), frequency: "weekly", daysOfWeek: [date.getDay()] } },
        { value: "monthly", label: `Monthly on the ${ordinalWeekday(date)}`, rule: { ...defaultRule(timeZone), frequency: "monthly" } },
        { value: "yearly", label: `Annually on ${date.toLocaleDateString(undefined, { month: "long", day: "numeric" })}`, rule: { ...defaultRule(timeZone), frequency: "yearly" } },
        { value: "weekdays", label: "Every weekday (Monday to Friday)", rule: { ...defaultRule(timeZone), frequency: "weekdays" } },
    ], [date.getDate(), date.getDay(), date.getMonth(), timeZone]);
    const selected = presets.find((preset) => JSON.stringify(preset.rule) === JSON.stringify(normalized))?.value || (normalized.frequency === "none" ? "none" : "custom");
    const choose = (value) => {
        if (value === "custom") {
            setCustom(normalized.frequency === "none" ? { ...defaultRule(timeZone), frequency: "weekly", daysOfWeek: [date.getDay()] } : normalized);
            setCustomOpen(true);
            return;
        }
        onChange(presets.find((preset) => preset.value === value).rule);
    };
    const update = (fields) => setCustom((current) => ({ ...current, ...fields }));
    const saveCustom = () => { onChange(custom); setCustomOpen(false); };
    return <>
        <div className="repeat-select"><MaterialIcon size={19}>repeat</MaterialIcon><SelectMenu ariaLabel="Repeat" value={selected} onChange={choose} options={[...presets.map(({ value, label }) => ({ value, label })), { value: "custom", label: "Custom…" }]} /></div>
        {customOpen && <div className="recurrence-dialog-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setCustomOpen(false); }}><section aria-labelledby="custom-recurrence-title" aria-modal="true" className="recurrence-dialog" role="dialog">
            <h3 id="custom-recurrence-title">Custom recurrence</h3>
            <div className="recurrence-line"><span>Repeat every</span><input aria-label="Repeat interval" min="1" max="99" type="number" value={custom.interval} onChange={(event) => update({ interval: Number(event.target.value) || 1 })} /><SelectMenu ariaLabel="Repeat frequency" value={custom.frequency} onChange={(frequency) => update({ frequency, daysOfWeek: frequency === "weekly" && !custom.daysOfWeek.length ? [date.getDay()] : custom.daysOfWeek })} options={[{ value: "daily", label: "day" }, { value: "weekly", label: "week" }, { value: "monthly", label: "month" }, { value: "yearly", label: "year" }]} /></div>
            {custom.frequency === "weekly" && <fieldset className="recurrence-weekdays"><legend>Repeat on</legend>{shortWeekdays.map((label, day) => <label key={day} title={weekdays[day]}><input type="checkbox" checked={custom.daysOfWeek.includes(day)} onChange={(event) => update({ daysOfWeek: event.target.checked ? [...custom.daysOfWeek, day].sort() : custom.daysOfWeek.filter((value) => value !== day) })} /><span>{label}</span></label>)}</fieldset>}
            {custom.frequency === "monthly" && <div className="recurrence-monthly">Repeat by<SelectMenu ariaLabel="Repeat by" value={custom.monthlyMode} onChange={(monthlyMode) => update({ monthlyMode })} options={[{ value: "ordinalWeekday", label: `the ${ordinalWeekday(date)}` }, { value: "dayOfMonth", label: `day ${date.getDate()}` }]} /></div>}
            <fieldset className="recurrence-ends"><legend>Ends</legend><label><input type="radio" checked={custom.endType === "never"} onChange={() => update({ endType: "never", count: null, until: null })} />Never</label><label><input type="radio" checked={custom.endType === "until"} onChange={() => update({ endType: "until", until: custom.until || startAt.slice(0, 10), count: null })} />On <input aria-label="Recurrence end date" disabled={custom.endType !== "until"} min={startAt.slice(0, 10)} type="date" value={custom.until ? String(custom.until).slice(0, 10) : ""} onChange={(event) => update({ until: event.target.value })} /></label><label><input type="radio" checked={custom.endType === "count"} onChange={() => update({ endType: "count", count: custom.count || 10, until: null })} />After <input aria-label="Number of occurrences" disabled={custom.endType !== "count"} min="1" max="730" type="number" value={custom.count || 10} onChange={(event) => update({ count: Number(event.target.value) || 1 })} /> occurrences</label></fieldset>
            <div className="recurrence-dialog-actions"><button type="button" onClick={() => setCustomOpen(false)}>Cancel</button><button type="button" className="primary-button" disabled={custom.frequency === "weekly" && !custom.daysOfWeek.length} onClick={saveCustom}>Done</button></div>
        </section></div>}
    </>;
}
