import { useEffect, useId, useRef, useState } from "react";
import { MaterialIcon } from "../../shared/components/MaterialIcon.jsx";
import { peopleApi } from "./people.api.js";

const initials = (name) => name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
const identity = (person) => String(person.email || person.name || person._id).trim().toLowerCase();
const matchesPerson = (left, right) => Boolean(left._id && right._id && String(left._id) === String(right._id)) || identity(left) === identity(right);

export function PeoplePicker({
    className = "",
    inputLabel = "Search for people",
    maxSelected = 10,
    onSelectionChange,
    placeholder = "Search for people",
    selectedLabel = "Selected people",
    selectedPeople = [],
    showLeadingIcon = true,
}) {
    const [query, setQuery] = useState("");
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const [retryToken, setRetryToken] = useState(0);
    const [activeIndex, setActiveIndex] = useState(0);
    const root = useRef(null);
    const instanceId = useId().replace(/:/g, "");
    const resultsId = `${instanceId}-people-results`;
    const available = selectedPeople.length >= maxSelected ? [] : results.filter((person) => !selectedPeople.some((selected) => matchesPerson(selected, person)));

    useEffect(() => {
        if (!open) return undefined;
        let active = true;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            setError("");
            try {
                const people = await peopleApi.search(query.trim());
                if (active) setResults(people);
            } catch (requestError) {
                if (active) setError(requestError.message);
            } finally {
                if (active) setLoading(false);
            }
        }, 180);
        return () => { active = false; window.clearTimeout(timer); };
    }, [open, query, retryToken]);

    useEffect(() => {
        if (!open) return undefined;
        const close = (event) => { if (!root.current?.contains(event.target)) setOpen(false); };
        document.addEventListener("pointerdown", close);
        return () => document.removeEventListener("pointerdown", close);
    }, [open]);

    const add = (person) => {
        if (selectedPeople.length >= maxSelected || selectedPeople.some((selected) => matchesPerson(selected, person))) return;
        onSelectionChange([...selectedPeople, person]);
        setQuery("");
        setOpen(false);
    };
    const remove = (person) => onSelectionChange(selectedPeople.filter((selected) => !matchesPerson(selected, person)));
    const handleSearchKeyboard = (event) => {
        if (event.key === "Escape") { setOpen(false); return; }
        if (!["ArrowDown", "ArrowUp", "Enter"].includes(event.key)) return;
        if (!open) { setOpen(true); return; }
        if (!available.length) return;
        event.preventDefault();
        if (event.key === "ArrowDown") setActiveIndex((index) => (index + 1) % available.length);
        if (event.key === "ArrowUp") setActiveIndex((index) => (index - 1 + available.length) % available.length);
        if (event.key === "Enter") add(available[Math.min(activeIndex, available.length - 1)]);
    };

    return <div className={`people-picker ${className}`.trim()} ref={root}>
        <div className={`people-search ${open ? "active" : ""}`}>
            {showLeadingIcon && <MaterialIcon size={20}>group</MaterialIcon>}
            <label><span className="sr-only">{inputLabel}</span><input aria-activedescendant={open && available[activeIndex] ? `${instanceId}-person-option-${available[activeIndex]._id}` : undefined} aria-autocomplete="list" aria-controls={resultsId} aria-expanded={open} autoComplete="off" className="people-search-input" placeholder={placeholder} value={query} onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); setOpen(true); }} onFocus={() => setOpen(true)} onKeyDown={handleSearchKeyboard} /></label>
            {query && <button className="icon-button" type="button" aria-label="Clear people search" onClick={() => setQuery("")}><MaterialIcon size={18}>close</MaterialIcon></button>}
            {open && <div className="people-results" id={resultsId} role="listbox" aria-label="People">
                {loading && <p role="status">Finding people…</p>}
                {!loading && error && <div className="people-state" role="alert"><span>{error}</span><button type="button" onClick={() => setRetryToken((value) => value + 1)}>Retry</button></div>}
                {!loading && !error && available.map((person, index) => <button className={index === activeIndex ? "active" : ""} id={`${instanceId}-person-option-${person._id}`} key={person._id} role="option" type="button" aria-selected={index === activeIndex} onMouseEnter={() => setActiveIndex(index)} onClick={() => add(person)}>
                    <span className="person-avatar" style={{ backgroundColor: person.avatarColor }}>{initials(person.name)}</span>
                    <span><strong>{person.name}</strong><small>{person.email}</small></span>
                </button>)}
                {!loading && !error && !available.length && <p>{selectedPeople.length >= maxSelected ? `Guest limit reached (${maxSelected})` : query ? "No matching people" : selectedPeople.length ? "Everyone is already selected" : "No people available"}</p>}
            </div>}
        </div>
        {selectedPeople.length > 0 && <div className="selected-people" aria-label={selectedLabel}>
            {selectedPeople.map((person, index) => <div className="selected-person" key={`${identity(person)}-${index}`}>
                <span className="person-avatar" style={{ backgroundColor: person.avatarColor || "#5f6368" }}>{initials(person.name)}</span>
                <span title={person.email || person.name}>{person.name}</span>
                <button type="button" aria-label={`Remove ${person.name}`} onClick={() => remove(person)}><MaterialIcon size={16}>close</MaterialIcon></button>
            </div>)}
        </div>}
    </div>;
}
