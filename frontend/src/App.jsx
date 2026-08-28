import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarHeader } from "./features/calendar/CalendarHeader.jsx";
import { CalendarSidebar } from "./features/calendar/CalendarSidebar.jsx";
import { MonthView } from "./features/calendar/MonthView.jsx";
import { TimeGrid } from "./features/calendar/TimeGrid.jsx";
import { calendarApi } from "./features/calendar/calendar.api.js";
import { EventEditor } from "./features/events/EventEditor.jsx";
import { EventPreview } from "./features/events/EventPreview.jsx";
import { AdvancedSearchPanel } from "./features/events/AdvancedSearchPanel.jsx";
import { SearchResults } from "./features/events/SearchResults.jsx";
import { eventApi } from "./features/events/event.api.js";
import { insightApi } from "./features/insights/insight.api.js";
import { TimeInsightsDrawer } from "./features/insights/TimeInsightsDrawer.jsx";
import { SuggestedTimesDrawer } from "./features/people/SuggestedTimesDrawer.jsx";
import { AvailabilityComparison } from "./features/people/AvailabilityComparison.jsx";
import { profileApi } from "./features/profiles/profile.api.js";
import { ProfilePicker } from "./features/profiles/ProfilePicker.jsx";
import { setActiveProfileId } from "./shared/api/client.js";
import { addDays, getViewRange, startOfMonth } from "./shared/utils/date.js";

export function CalendarWorkspace({ activeProfile, onSwitchProfile }) {
    const [cursor, setCursor] = useState(new Date());
    const [view, setViewState] = useState(() => {
        const stored = localStorage.getItem("calendar-view");
        return ["day", "week", "month"].includes(stored) ? stored : "week";
    });
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const stored = localStorage.getItem("calendar-sidebar");
        if (stored) return stored === "collapsed";
        return window.matchMedia?.("(max-width: 840px)").matches ?? false;
    });
    const [miniMonth, setMiniMonth] = useState(startOfMonth(new Date()));
    const [calendars, setCalendars] = useState([]);
    const [events, setEvents] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [editorDraft, setEditorDraft] = useState(null);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [searchMode, setSearchMode] = useState(false);
    const [searchPanelOpen, setSearchPanelOpen] = useState(false);
    const [searchCriteria, setSearchCriteria] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [searchStatus, setSearchStatus] = useState({ loading: false, error: "" });
    const [insights, setInsights] = useState(null);
    const [insightsOpen, setInsightsOpen] = useState(false);
    const [insightsStatus, setInsightsStatus] = useState({ loading: true, error: "" });
    const [meetingPeople, setMeetingPeople] = useState([]);
    const [suggestionPeople, setSuggestionPeople] = useState(null);
    const [availabilityRevision, setAvailabilityRevision] = useState(0);
    const visibleIds = useMemo(() => calendars.filter((calendar) => calendar.visible).map((calendar) => calendar._id), [calendars]);
    const range = useMemo(() => getViewRange(view, cursor), [view, cursor]);
    const insightRange = useMemo(() => { const start = new Date(cursor.getFullYear(), cursor.getMonth(), cursor.getDate()); return [start, addDays(start, 1)]; }, [cursor]);
    const setView = useCallback((nextView) => { if (meetingPeople.length && nextView !== "day") setMeetingPeople([]); localStorage.setItem("calendar-view", nextView); setViewState(nextView); }, [meetingPeople.length]);

    const loadCalendars = useCallback(async () => {
        try { setError(""); setCalendars(await calendarApi.list()); } catch (requestError) { setError(requestError.message); }
    }, []);
    const loadEvents = useCallback(async () => {
        if (!calendars.length || !visibleIds.length) { setEvents([]); setLoading(false); return; }
        try { setLoading(true); setError(""); setEvents(await eventApi.list(range[0].toISOString(), range[1].toISOString(), visibleIds)); }
        catch (requestError) { setError(requestError.message); }
        finally { setLoading(false); }
    }, [calendars.length, range, visibleIds]);
    const loadInsights = useCallback(async () => {
        if (!calendars.length || !visibleIds.length) { setInsights(null); setInsightsStatus({ loading: false, error: "" }); return; }
        try {
            setInsightsStatus({ loading: true, error: "" });
            setInsights(await insightApi.daily(insightRange[0].toISOString(), insightRange[1].toISOString(), visibleIds));
            setInsightsStatus({ loading: false, error: "" });
        } catch (requestError) {
            setInsightsStatus({ loading: false, error: requestError.message });
        }
    }, [calendars.length, insightRange, visibleIds]);

    useEffect(() => { loadCalendars(); }, [loadCalendars]);
    useEffect(() => { loadEvents(); }, [loadEvents]);
    useEffect(() => { loadInsights(); }, [loadInsights]);
    useEffect(() => { setMiniMonth(startOfMonth(cursor)); }, [cursor]);
    useEffect(() => {
        const handler = (event) => {
            if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || event.metaKey || event.ctrlKey || event.altKey) return;
            const shortcuts = { d: "day", w: "week", m: "month" };
            if (event.key === "c") setEditorDraft({ cursor, type: "event" });
            if (event.key === "t") setCursor(new Date());
            if (event.key === "/") { event.preventDefault(); setSearchMode(true); setSearchPanelOpen(false); }
            if (shortcuts[event.key]) setView(shortcuts[event.key]);
        };
        window.addEventListener("keydown", handler);
        return () => window.removeEventListener("keydown", handler);
    }, [cursor, setView]);

    const toggleSidebar = () => { const next = !sidebarCollapsed; setSidebarCollapsed(next); localStorage.setItem("calendar-sidebar", next ? "collapsed" : "expanded"); };
    const createEvent = (startAt, type = "event") => setEditorDraft({ cursor, type, ...(startAt ? { startAt } : {}) });
    const selectEvent = (event) => { setError(""); setSelectedEvent(event); };
    const saveEvent = async (payload) => { if (editorDraft?._id) await eventApi.update(editorDraft._id, payload); else await eventApi.create(payload); setEditorDraft(null); setSelectedEvent(null); setError(""); await Promise.all([loadEvents(), loadInsights()]); setAvailabilityRevision((revision) => revision + 1); };
    const deleteEvent = async () => { try { await eventApi.remove(selectedEvent._id); setSelectedEvent(null); setError(""); await Promise.all([loadEvents(), loadInsights()]); } catch (requestError) { setError(requestError.message); } };
    const updateCalendar = async (id, values) => { const updated = await calendarApi.update(id, values); setCalendars((items) => items.map((item) => item._id === id ? updated : item)); setError(""); return updated; };
    const createCalendar = async (values) => { const created = await calendarApi.create(values); setCalendars((items) => [...items, created]); setError(""); return created; };
    const displayOnlyCalendar = async (id) => { const updated = await calendarApi.displayOnly(id); setCalendars(updated); setError(""); return updated; };
    const deleteCalendar = async (calendar) => { if (!window.confirm(`Delete “${calendar.name}”? Empty calendars only can be deleted.`)) return false; try { await calendarApi.remove(calendar._id); setCalendars((items) => items.filter((item) => item._id !== calendar._id)); setError(""); return true; } catch (requestError) { setError(requestError.message); return false; } };
    const selectMiniDate = (date) => { setCursor(date); setMiniMonth(startOfMonth(date)); };
    const openSearch = () => { setSearchMode(true); setSearchPanelOpen(false); };
    const closeSearch = () => { setSearchMode(false); setSearchPanelOpen(false); setSearchCriteria(null); setSearchResults([]); setSearchStatus({ loading: false, error: "" }); };
    const executeSearch = async (criteria) => {
        const calendarIds = criteria.scope === "all" ? calendars.map((calendar) => calendar._id) : visibleIds;
        setSearchCriteria(criteria);
        setSearchPanelOpen(false);
        setSearchStatus({ loading: true, error: "" });
        try { setSearchResults(calendarIds.length ? await eventApi.search(criteria, calendarIds) : []); setSearchStatus({ loading: false, error: "" }); }
        catch (requestError) { setSearchStatus({ loading: false, error: requestError.message }); }
    };
    const chooseSuggestedTime = (suggestion, people) => {
        const startAt = new Date(suggestion.startAt);
        setCursor(startAt);
        setSuggestionPeople(null);
        setEditorDraft({ cursor: startAt, startAt: suggestion.startAt, endAt: suggestion.endAt, type: "event", title: `Meeting with ${people.map((person) => person.name).join(", ")}`, participants: people.map((person) => person.name), participantPeople: people });
    };
    const changeMeetingPeople = (people) => {
        setMeetingPeople(people);
        if (people.length) { setView("day"); setSearchMode(false); setSearchCriteria(null); }
    };
    const createMeeting = (startAt, people = meetingPeople) => setEditorDraft({ cursor: startAt, startAt, type: "event", title: people.length ? `Meeting with ${people.map((person) => person.name).join(", ")}` : "", participants: people.map((person) => person.name), participantPeople: people });
    const renderView = () => {
        if (meetingPeople.length) return <AvailabilityComparison cursor={cursor} key={availabilityRevision} ownerColor={calendars.find((calendar) => calendar.isPrimary)?.color} people={meetingPeople} onCreate={createMeeting} onEventSelect={selectEvent} />;
        if (loading) return <div className="view-status" role="status">Loading calendar…</div>;
        if (!visibleIds.length) return <div className="empty-state"><h2>All calendars are hidden</h2><p>Turn on a calendar in the sidebar to see its events.</p></div>;
        if (view === "day") return <TimeGrid calendars={calendars} cursor={cursor} days={1} events={events} onCreate={createEvent} onEventSelect={selectEvent} />;
        if (view === "week") return <TimeGrid calendars={calendars} cursor={cursor} days={7} events={events} onCreate={createEvent} onEventSelect={selectEvent} />;
        if (view === "month") return <MonthView calendars={calendars} cursor={cursor} events={events} onCreate={createEvent} onDaySelect={(date) => { setCursor(date); setView("day"); }} onEventSelect={selectEvent} />;
        return <MonthView calendars={calendars} cursor={cursor} events={events} onCreate={createEvent} onDaySelect={(date) => { setCursor(date); setView("day"); }} onEventSelect={selectEvent} />;
    };

    return <div className={`app-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
        <CalendarHeader cursor={cursor} onCreate={() => createEvent()} onProfileSwitch={onSwitchProfile} onSearchClose={closeSearch} onSearchOpen={openSearch} onSidebarToggle={toggleSidebar} profile={activeProfile} searchMode={searchMode} setCursor={setCursor} setView={setView} view={view} />
        <CalendarSidebar calendars={calendars} collapsed={sidebarCollapsed} cursor={cursor} insights={insights} insightsError={insightsStatus.error} insightsLoading={insightsStatus.loading} meetingPeople={meetingPeople} miniMonth={miniMonth} onCalendarCreate={createCalendar} onCalendarDelete={deleteCalendar} onCalendarDisplayOnly={displayOnlyCalendar} onCalendarUpdate={updateCalendar} onCreate={(type) => createEvent(undefined, type)} onInsightsOpen={() => setInsightsOpen(true)} onInsightsRetry={loadInsights} onMeetingPeopleChange={changeMeetingPeople} onMiniMonthChange={setMiniMonth} onOpenSuggestions={setSuggestionPeople} onSelectDate={selectMiniDate} />
        {!sidebarCollapsed && <button className="sidebar-scrim" aria-label="Close sidebar" onClick={toggleSidebar} />}
        <main className="calendar-surface">
            {error && <div className="service-error" role="alert"><span>{error}</span><button onClick={() => { loadCalendars(); loadEvents(); }}>Retry</button></div>}
            {searchCriteria !== null ? <SearchResults calendars={calendars} criteria={searchCriteria} error={searchStatus.error} loading={searchStatus.loading} onClear={() => { setSearchCriteria(null); setSearchPanelOpen(true); }} onEventSelect={selectEvent} results={searchResults} /> : renderView()}
        </main>
        {searchMode && <AdvancedSearchPanel expanded={searchPanelOpen} initialValues={searchCriteria} onDismiss={closeSearch} onExpandedChange={setSearchPanelOpen} onSearch={executeSearch} />}
        {editorDraft && <EventEditor calendars={calendars} draft={editorDraft} onClose={() => setEditorDraft(null)} onSave={saveEvent} />}
        {selectedEvent && !editorDraft && <EventPreview calendar={calendars.find((calendar) => calendar._id === String(selectedEvent.calendarId))} error={error} event={selectedEvent} onClose={() => { setSelectedEvent(null); setError(""); }} onDelete={deleteEvent} onEdit={() => { setEditorDraft(selectedEvent); setSelectedEvent(null); setError(""); }} />}
        {insightsOpen && <TimeInsightsDrawer cursor={cursor} insights={insights} loading={insightsStatus.loading} onClose={() => setInsightsOpen(false)} onScheduleFocus={() => { setInsightsOpen(false); createEvent(undefined, "focusTime"); }} />}
        {suggestionPeople && <SuggestedTimesDrawer cursor={cursor} people={suggestionPeople} onChoose={chooseSuggestedTime} onClose={() => setSuggestionPeople(null)} />}
    </div>;
}

export default function App() {
    const [profiles, setProfiles] = useState(null);
    const [profileError, setProfileError] = useState("");
    const [selectedProfileId, setSelectedProfileId] = useState(() => localStorage.getItem("calendar-profile-id") || "");
    const loadProfiles = useCallback(async () => {
        try { setProfileError(""); setProfiles(await profileApi.list()); }
        catch (error) { setProfileError(error.message); setProfiles([]); }
    }, []);
    useEffect(() => { loadProfiles(); }, [loadProfiles]);
    const activeProfile = profiles?.find((profile) => String(profile._id) === selectedProfileId);
    useEffect(() => {
        if (profiles === null) return;
        if (selectedProfileId && !activeProfile) {
            localStorage.removeItem("calendar-profile-id");
            setSelectedProfileId("");
        }
        setActiveProfileId(activeProfile?._id || "");
    }, [activeProfile, profiles, selectedProfileId]);
    if (activeProfile) {
        return <CalendarWorkspace activeProfile={activeProfile} key={activeProfile._id} onSwitchProfile={() => { localStorage.removeItem("calendar-profile-id"); setActiveProfileId(""); setSelectedProfileId(""); }} />;
    }
    return <ProfilePicker error={profileError} loading={profiles === null} onRetry={loadProfiles} profiles={profiles || []} onSelect={(profile) => { localStorage.setItem("calendar-profile-id", profile._id); setActiveProfileId(profile._id); setSelectedProfileId(String(profile._id)); }} />;
}
