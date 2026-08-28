import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { CalendarHeader } from "../features/calendar/CalendarHeader.jsx";
import { CalendarSidebar } from "../features/calendar/CalendarSidebar.jsx";
import { CalendarEditor } from "../features/calendar/CalendarEditor.jsx";
import { MiniCalendar } from "../features/calendar/MiniCalendar.jsx";
import { MonthView } from "../features/calendar/MonthView.jsx";
import { TimeGrid } from "../features/calendar/TimeGrid.jsx";
import { getLayeredEventGeometry, layoutTimedEvents } from "../features/calendar/event-layout.js";
import { calendarColors, foregroundForColor, nextAvailableCalendarColor } from "../features/calendar/calendar-colors.js";
import { EventEditor } from "../features/events/EventEditor.jsx";
import { EventPreview } from "../features/events/EventPreview.jsx";
import { AdvancedSearchPanel } from "../features/events/AdvancedSearchPanel.jsx";
import { SearchResults } from "../features/events/SearchResults.jsx";
import { TimeInsightsDrawer } from "../features/insights/TimeInsightsDrawer.jsx";
import { TimeInsightsSummary } from "../features/insights/TimeInsightsSummary.jsx";
import { dateKey, formatHeading, formatTime, formatTimeZoneOffset, getViewRange, moveCursor, startOfWeek } from "../shared/utils/date.js";

const peopleMocks = vi.hoisted(() => ({ search: vi.fn() }));
const availabilityMocks = vi.hoisted(() => ({ conflicts: vi.fn() }));
vi.mock("../features/people/people.api.js", () => ({ peopleApi: { search: peopleMocks.search } }));
vi.mock("../features/people/availability.api.js", () => ({ availabilityApi: { conflicts: availabilityMocks.conflicts } }));

describe("calendar navigation", () => {
    test("keeps mobile month events accessible when their visible labels are hidden", () => {
        render(<MonthView calendars={[{ _id: "calendar-1", color: "#039be5" }]} cursor={new Date(2026, 7, 27)} events={[{ _id: "event-1", calendarId: "calendar-1", title: "Design review", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false }]} onCreate={vi.fn()} onDaySelect={vi.fn()} onEventSelect={vi.fn()} />);
        expect(screen.getByRole("button", { name: /Design review, 10:00 AM/ })).toBeInTheDocument();
    });
    test("computes a Monday-to-Sunday week range", () => {
        const cursor = new Date(2026, 7, 27, 12);
        const [start, end] = getViewRange("week", cursor);
        expect(start).toEqual(startOfWeek(cursor));
        expect((end - start) / 86400000).toBe(7);
    });

    test("changes view through the header", async () => {
        const setView = vi.fn();
        render(<CalendarHeader cursor={new Date(2026, 7, 27)} onCreate={vi.fn()} onSearchChange={vi.fn()} onSidebarToggle={vi.fn()} search={null} setCursor={vi.fn()} setView={setView} view="week" />);
        await userEvent.click(screen.getByTestId("view-select"));
        await userEvent.click(screen.getByRole("menuitemradio", { name: /Month/ }));
        expect(setView).toHaveBeenCalledWith("month");
    });

    test("shows only the requested calendar views", async () => {
        render(<CalendarHeader cursor={new Date(2026, 7, 27)} onCreate={vi.fn()} onSearchChange={vi.fn()} onSidebarToggle={vi.fn()} search={null} setCursor={vi.fn()} setView={vi.fn()} view="day" />);
        await userEvent.click(screen.getByTestId("view-select"));
        expect(screen.getAllByRole("menuitemradio").map((item) => item.textContent)).toEqual(["DayD", "WeekW", "MonthM"]);
    });

    test("formats the day title and local GMT offset like Google Calendar", () => {
        render(<CalendarHeader cursor={new Date(2026, 7, 27)} onCreate={vi.fn()} onSidebarToggle={vi.fn()} setCursor={vi.fn()} setView={vi.fn()} view="day" />);
        expect(screen.getByRole("heading", { name: "August 27, 2026" })).toBeInTheDocument();
        expect(formatTimeZoneOffset(new Date(2026, 7, 27))).toMatch(/^GMT[+-]\d{2}:\d{2}$/);
    });

    test("selects a date from the mini calendar", async () => {
        const onSelect = vi.fn();
        const { container } = render(<MiniCalendar cursor={new Date(2026, 7, 27)} month={new Date(2026, 7, 1)} onMonthChange={vi.fn()} onSelect={onSelect} />);
        await userEvent.click(container.querySelector('[data-date="2026-08-12"]'));
        expect(onSelect.mock.calls[0][0].getDate()).toBe(12);
    });

    test("handles leap-year, cross-year, and view navigation boundaries", () => {
        expect(dateKey(moveCursor("day", new Date(2028, 1, 28), 1))).toBe("2028-02-29");
        expect(dateKey(moveCursor("month", new Date(2026, 11, 15), 1))).toBe("2027-01-01");
        expect(formatHeading("week", new Date(2026, 7, 31))).toBe("Aug – Sep 2026");
    });

    test("moves the mini calendar without selecting a main-view date", async () => {
        const onMonthChange = vi.fn();
        const onSelect = vi.fn();
        render(<MiniCalendar cursor={new Date(2026, 7, 27)} month={new Date(2026, 7, 1)} onMonthChange={onMonthChange} onSelect={onSelect} />);
        await userEvent.click(screen.getByRole("button", { name: "Next month" }));
        expect(dateKey(onMonthChange.mock.calls[0][0])).toBe("2026-09-01");
        expect(onSelect).not.toHaveBeenCalled();
    });
});

describe("event behavior", () => {
    test("submits every advanced search filter", async () => {
        const onSearch = vi.fn();
        render(<AdvancedSearchPanel expanded onDismiss={vi.fn()} onExpandedChange={vi.fn()} onSearch={onSearch} />);
        await userEvent.selectOptions(screen.getByTestId("search-scope"), "all");
        await userEvent.type(screen.getByPlaceholderText("Keywords contained in event"), "planning");
        await userEvent.type(screen.getByPlaceholderText("Enter a participant, organizer, or creator"), "Alice");
        await userEvent.type(screen.getByPlaceholderText("Enter a location or room"), "Cedar");
        await userEvent.type(screen.getByPlaceholderText("Keywords not contained in event"), "cancelled");
        fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-08-01" } });
        fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-08-31" } });
        await userEvent.click(screen.getByRole("button", { name: "Search" }));
        expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ scope: "all", what: "planning", who: "Alice", where: "Cedar", exclude: "cancelled", from: "2026-08-01", to: "2026-08-31" }));
    });

    test("reveals advanced filters only from the search dropdown", async () => {
        const onExpandedChange = vi.fn();
        render(<AdvancedSearchPanel expanded={false} onDismiss={vi.fn()} onExpandedChange={onExpandedChange} onSearch={vi.fn()} />);
        expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
        expect(screen.queryByPlaceholderText("Keywords contained in event")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Show search options" }));
        expect(onExpandedChange).toHaveBeenCalledWith(true);
    });

    test("submits a quick search without opening advanced options", async () => {
        const onSearch = vi.fn();
        render(<AdvancedSearchPanel expanded={false} onDismiss={vi.fn()} onExpandedChange={vi.fn()} onSearch={onSearch} />);
        await userEvent.type(screen.getByRole("textbox", { name: "Search" }), "design{Enter}");
        expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ quick: "design", what: "design" }));
    });

    test("blocks invalid date ranges received through native input events", () => {
        render(<AdvancedSearchPanel expanded onDismiss={vi.fn()} onExpandedChange={vi.fn()} onSearch={vi.fn()} />);
        fireEvent.input(screen.getByLabelText("From date"), { target: { value: "2026-08-29" } });
        fireEvent.input(screen.getByLabelText("To date"), { target: { value: "2026-08-28" } });
        expect(screen.getByRole("alert")).toHaveTextContent("To date must be on or after From date");
        expect(screen.getByRole("button", { name: "Search" })).toBeDisabled();
    });

    test("offers every functional create type", async () => {
        const onCreate = vi.fn();
        render(<CalendarSidebar calendars={[]} collapsed={false} cursor={new Date(2026, 7, 27)} miniMonth={new Date(2026, 7, 1)} onCalendarCreate={vi.fn()} onCalendarDelete={vi.fn()} onCalendarUpdate={vi.fn()} onCreate={onCreate} onMiniMonthChange={vi.fn()} onSelectDate={vi.fn()} />);
        const options = [["Event", "event"], ["Task", "task"], ["Out of office", "outOfOffice"], ["Focus time", "focusTime"], ["Working location", "workingLocation"], ["Appointment schedule", "appointmentSchedule"]];
        for (const [label, type] of options) {
            await userEvent.click(screen.getByTestId("create-event-button"));
            await userEvent.click(screen.getByRole("menuitem", { name: label }));
            expect(onCreate).toHaveBeenLastCalledWith(type);
        }
    });

    test("assigns overlapping events to separate columns", () => {
        const events = [
            { id: "a", startAt: "2026-08-27T09:00:00Z", endAt: "2026-08-27T10:00:00Z" },
            { id: "b", startAt: "2026-08-27T09:30:00Z", endAt: "2026-08-27T10:30:00Z" },
        ];
        const layout = layoutTimedEvents(events);
        expect(layout.map((item) => item.column)).toEqual([0, 1]);
        expect(layout.every((item) => item.columns === 2)).toBe(true);
        expect(getLayeredEventGeometry(0, 2)).toMatchObject({ left: 0, width: 82 });
        expect(getLayeredEventGeometry(1, 2)).toMatchObject({ left: 48, width: 52 });
    });

    test("preserves input and prevents an invalid event range", async () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ startAt: new Date("2026-08-27T10:00:00"), cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={vi.fn()} />);
        await userEvent.type(screen.getByTestId("event-title-input"), "Planning");
        fireEvent.change(screen.getByRole("textbox", { name: "End time" }), { target: { value: "9:00 AM" } });
        expect(screen.getByTestId("save-event-button")).toBeDisabled();
        expect(screen.getByTestId("event-title-input")).toHaveValue("Planning");
    });

    test("revalidates datetime fields for native input events", async () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "focusTime", cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={vi.fn()} />);
        fireEvent.input(screen.getByRole("textbox", { name: "Start time" }), { target: { value: "6:00 PM" } });
        fireEvent.input(screen.getByRole("textbox", { name: "End time" }), { target: { value: "5:00 PM" } });
        expect(screen.getByTestId("save-event-button")).toBeDisabled();
    });

    test("offers 15-minute time choices while accepting a custom typed minute", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00"), title: "Custom time" }} onClose={vi.fn()} onSave={onSave} />);
        const start = screen.getByRole("textbox", { name: "Start time" });
        await userEvent.click(start);
        expect(screen.getByRole("option", { name: "6:15pm" })).toBeInTheDocument();
        await userEvent.clear(start);
        await userEvent.type(start, "6:37pm");
        await userEvent.tab();
        expect(start).toHaveValue("6:37pm");
    });

    test("offers a full day of contextual end times and handles midnight rollover", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T22:30:00"), startAt: new Date("2026-08-27T22:30:00"), endAt: new Date("2026-08-27T23:30:00"), title: "Late review" }} onClose={vi.fn()} onSave={onSave} />);
        expect(screen.queryByText("Time zone")).not.toBeInTheDocument();
        expect(screen.queryByText("Does not repeat")).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("textbox", { name: "End time" }));
        expect(screen.getByRole("option", { name: "10:45pm (15 mins)" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "11:00pm (30 mins)" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "11:30pm (1 hr)" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "1:30am (3 hrs)" })).toBeInTheDocument();
        expect(screen.getByRole("option", { name: "10:30pm (24 hrs)" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("option", { name: "12:30am (2 hrs)" }));
        expect(screen.getByRole("textbox", { name: "End time" })).toHaveValue("12:30am");
        expect(screen.getByRole("button", { name: /End date: Friday, August 28/ })).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(dateKey(onSave.mock.calls[0][0].endAt)).toBe("2026-08-28");
    });

    test("infers next-day rollover for a custom typed end time and exposes its date control", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T23:00:00"), startAt: new Date("2026-08-27T23:00:00"), endAt: new Date("2026-08-28T00:00:00"), title: "Midnight handoff" }} onClose={vi.fn()} onSave={onSave} />);
        const end = screen.getByRole("textbox", { name: "End time" });
        fireEvent.change(end, { target: { value: "12:10am" } });
        fireEvent.blur(end);
        expect(screen.getByRole("button", { name: /End date: Friday, August 28/ })).toBeInTheDocument();
        expect(screen.getByTestId("save-event-button")).toBeEnabled();
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(dateKey(onSave.mock.calls[0][0].endAt)).toBe("2026-08-28");
    });

    test("removes the end-date control when a rolled-over event returns to the start day", () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T23:00:00"), startAt: new Date("2026-08-27T23:00:00"), endAt: new Date("2026-08-28T00:00:00"), title: "Midnight handoff" }} onClose={vi.fn()} onSave={vi.fn()} />);
        expect(screen.getByRole("button", { name: /End date: Friday, August 28/ })).toBeInTheDocument();
        fireEvent.change(screen.getByRole("textbox", { name: "End time" }), { target: { value: "11:30pm" } });
        expect(screen.queryByRole("button", { name: /End date:/ })).not.toBeInTheDocument();
        expect(screen.getByTestId("save-event-button")).toBeEnabled();
    });

    test("normalizes a cross-midnight event to one date when switching to an all-day type", async () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T23:00:00"), startAt: new Date("2026-08-27T23:00:00"), endAt: new Date("2026-08-28T00:00:00"), title: "Late event" }} onClose={vi.fn()} onSave={vi.fn()} />);
        await userEvent.click(screen.getByRole("tab", { name: "Out of office" }));
        expect(screen.getByRole("button", { name: /Start date: Thursday, August 27/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /End date:/ })).not.toBeInTheDocument();
    });

    test("switches creation type and chooses a date from the calendar popover", async () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={vi.fn()} />);
        await userEvent.click(screen.getByRole("tab", { name: "Out of office" }));
        expect(screen.getByTestId("event-title-input")).toHaveValue("Out of office");
        expect(screen.getByRole("checkbox", { name: "All day" })).toBeChecked();
        await userEvent.click(screen.getByRole("button", { name: /Start date:/ }));
        await userEvent.click(screen.getByRole("button", { name: "Friday, August 28, 2026" }));
        expect(screen.getByRole("button", { name: /Start date: Friday, August 28/ })).toBeInTheDocument();
    });

    test("disables event save until the required title is valid", async () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={vi.fn()} />);
        const save = screen.getByTestId("save-event-button");
        expect(save).toBeDisabled();
        await userEvent.type(screen.getByTestId("event-title-input"), "  Review  ");
        expect(save).toBeEnabled();
        await userEvent.clear(screen.getByTestId("event-title-input"));
        expect(save).toBeDisabled();
    });

    test("submits a complete valid event", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ startAt: new Date("2026-08-27T10:00:00"), cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.type(screen.getByTestId("event-title-input"), "Planning");
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ title: "Planning", type: "event", calendarId: "calendar-1", allDay: false }));
    });

    test("normalizes all-day dates and preserves saved guests", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "outOfOffice", cursor: new Date("2026-08-27T10:00:00"), participants: ["Alice", "Bob"] }} onClose={vi.fn()} onSave={onSave} />);
        expect(screen.getByRole("button", { name: /Start date: Thursday, August 27/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /End date:/ })).not.toBeInTheDocument();
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Alice");
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Bob");
        await userEvent.click(screen.getByTestId("save-event-button"));
        const payload = onSave.mock.calls[0][0];
        expect(payload).toEqual(expect.objectContaining({ allDay: true, participants: ["Alice", "Bob"] }));
        expect(dateKey(payload.startAt)).toBe("2026-08-27");
        expect(dateKey(payload.endAt)).toBe("2026-08-28");
    });

    test("searches, selects, removes, and persists event guests", async () => {
        const alice = { _id: "person-1", name: "Alice Rao", email: "alice@example.com", avatarColor: "#1a73e8" };
        const bob = { _id: "person-2", name: "Bob Singh", email: "bob@example.com", avatarColor: "#0f9d58" };
        const onSave = vi.fn().mockResolvedValue(undefined);
        peopleMocks.search.mockResolvedValue([alice, bob]);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "outOfOffice", cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={onSave} />);
        const search = screen.getByRole("textbox", { name: "Search guests" });
        await userEvent.click(search);
        await userEvent.click(await screen.findByRole("option", { name: /Alice Rao/ }));
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Alice Rao");
        await userEvent.click(search);
        expect(screen.queryByRole("option", { name: /Alice Rao/ })).not.toBeInTheDocument();
        await userEvent.click(await screen.findByRole("option", { name: /Bob Singh/ }));
        await userEvent.click(screen.getByRole("button", { name: "Remove Alice Rao" }));
        expect(screen.getByLabelText("Selected guests")).not.toHaveTextContent("Alice Rao");
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: ["Bob Singh"] }));
    });

    test("warns about guest conflicts live and rechecks availability before save", async () => {
        const person = { _id: "64f000000000000000000001", name: "Alice Rao", email: "alice@example.com", avatarColor: "#1a73e8" };
        const conflict = { person, busy: [{ title: "Design review", startAt: "2026-08-27T10:15:00.000Z", endAt: "2026-08-27T11:00:00.000Z" }] };
        const onSave = vi.fn().mockResolvedValue(undefined);
        peopleMocks.search.mockResolvedValue([person]);
        availabilityMocks.conflicts.mockResolvedValue({ available: false, conflicts: [conflict] });
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00"), title: "Planning" }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.click(screen.getByRole("textbox", { name: "Search guests" }));
        await userEvent.click(await screen.findByRole("option", { name: /Alice Rao/ }));
        expect(await screen.findByText("Alice Rao is unavailable")).toBeInTheDocument();
        expect(screen.getByText(/Alice Rao: .*–/)).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(availabilityMocks.conflicts).toHaveBeenCalledTimes(2);
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: ["Alice Rao"], participantIds: [person._id] }));
    });

    test("shows both date controls only for a genuine multi-day all-day item", () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "outOfOffice", allDay: true, startAt: new Date("2026-08-27T00:00:00"), endAt: new Date("2026-08-30T00:00:00"), cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={vi.fn()} />);
        expect(screen.getByRole("button", { name: /Start date: Thursday, August 27/ })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /End date: Saturday, August 29/ })).toBeInTheDocument();
    });

    test("keeps the editor open and reports backend save failures", async () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "focusTime", cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={vi.fn().mockRejectedValue(new Error("Calendar service unavailable"))} />);
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(await screen.findByRole("alert")).toHaveTextContent("Calendar service unavailable");
        expect(screen.getByTestId("save-event-button")).toBeEnabled();
    });

    test("respects event deletion confirmation and exposes preview details", async () => {
        const onDelete = vi.fn();
        const event = { _id: "event-1", title: "Planning", type: "task", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false, organizer: "Mahadevan", location: "Cedar", description: "Plan launch" };
        window.confirm = vi.fn(() => false);
        render(<EventPreview calendar={{ name: "Work", color: "#1a73e8" }} event={event} onClose={vi.fn()} onDelete={onDelete} onEdit={vi.fn()} />);
        expect(screen.getByText("Task")).toBeInTheDocument();
        expect(screen.getByText("Mahadevan")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Delete event" }));
        expect(onDelete).not.toHaveBeenCalled();
        window.confirm = () => true;
    });

    test("uses a typed preset for focus time", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "focusTime", cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={onSave} />);
        expect(screen.getByTestId("event-title-input")).toHaveValue("Focus time");
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ type: "focusTime", title: "Focus time" }));
    });

    test("keeps the event primary action readable while saving", async () => {
        let finishSave;
        const onSave = vi.fn(() => new Promise((resolve) => { finishSave = resolve; }));
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "focusTime", cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.click(screen.getByTestId("save-event-button"));
        const savingButton = await screen.findByRole("button", { name: "Saving…" });
        expect(savingButton).toBeDisabled();
        expect(savingButton).toHaveClass("primary-button");
        finishSave();
    });

    test("formats times with AM and PM independent of locale", () => {
        expect(formatTime(new Date(2026, 7, 27, 9, 5))).toMatch(/9:05 AM/);
        expect(formatTime(new Date(2026, 7, 27, 15, 30))).toMatch(/3:30 PM/);
    });
});

describe("calendar creation", () => {
    test("uses a compact unique palette and keeps custom colors readable", () => {
        expect(calendarColors).toHaveLength(12);
        expect(new Set(calendarColors.map((option) => option.value)).size).toBe(calendarColors.length);
        expect(foregroundForColor("#fbc02d")).toBe("#202124");
        expect(foregroundForColor("#3f51b5")).toBe("#fff");
        expect(nextAvailableCalendarColor([calendarColors[0].value])).toBe(calendarColors[1].value);
    });

    test("keeps an unavailable calendar primary action readable", () => {
        render(<CalendarEditor onClose={vi.fn()} onSave={vi.fn()} />);
        const createButton = screen.getByRole("button", { name: "Create calendar" });
        expect(createButton).toBeDisabled();
        expect(createButton).toHaveClass("primary-button");
    });

    test("submits complete calendar metadata and closes after success", async () => {
        const onSave = vi.fn().mockResolvedValue({ _id: "calendar-2" });
        const onClose = vi.fn();
        render(<CalendarEditor onClose={onClose} onSave={onSave} />);
        await userEvent.type(screen.getByTestId("calendar-name-input"), "Product launches");
        await userEvent.type(screen.getByPlaceholderText("What is this calendar for?"), "Release milestones");
        await userEvent.click(screen.getByTitle("Basil"));
        await userEvent.click(screen.getByTestId("create-calendar-submit"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ name: "Product launches", description: "Release milestones", color: "#0b8043", timeZone: expect.any(String) }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    test("preserves values and displays backend creation failures", async () => {
        render(<CalendarEditor onClose={vi.fn()} onSave={vi.fn().mockRejectedValue(new Error("A calendar with this name already exists."))} />);
        await userEvent.type(screen.getByTestId("calendar-name-input"), "Work");
        await userEvent.click(screen.getByTestId("create-calendar-submit"));
        expect(await screen.findByRole("alert")).toHaveTextContent("already exists");
        expect(screen.getByTestId("calendar-name-input")).toHaveValue("Work");
    });

    test("offers display-only, settings, and persisted palette actions", async () => {
        const calendars = [
            { _id: "primary", name: "My calendar", color: "#4285f4", defaultColor: "#4285f4", visible: true, isPrimary: true, description: "", timeZone: "UTC" },
            { _id: "work", name: "Work", color: "#0b8043", defaultColor: "#0b8043", visible: true, isPrimary: false, description: "Team events", timeZone: "Asia/Kolkata" },
        ];
        const onDisplayOnly = vi.fn().mockResolvedValue(calendars);
        const onUpdate = vi.fn().mockResolvedValue(calendars[1]);
        render(<CalendarSidebar calendars={calendars} collapsed={false} cursor={new Date(2026, 7, 27)} miniMonth={new Date(2026, 7, 1)} onCalendarCreate={vi.fn()} onCalendarDelete={vi.fn()} onCalendarDisplayOnly={onDisplayOnly} onCalendarUpdate={onUpdate} onCreate={vi.fn()} onMiniMonthChange={vi.fn()} onSelectDate={vi.fn()} />);

        await userEvent.click(screen.getByRole("button", { name: "Manage Work" }));
        expect(screen.getByRole("menu", { name: "Work options" })).toBeInTheDocument();
        expect(screen.getAllByRole("button", { name: /Cornflower|Burnt orange|Berry|Teal|Grape|Tomato|Basil|Indigo|Cyan|Cocoa|Olive|Graphite/ })).toHaveLength(12);
        await userEvent.click(screen.getByRole("menuitem", { name: "Display this only" }));
        expect(onDisplayOnly).toHaveBeenCalledWith("work");

        await userEvent.click(screen.getByRole("button", { name: "Manage Work" }));
        expect(screen.getByRole("menuitemradio", { name: "Default" })).toHaveAttribute("aria-checked", "true");
        await userEvent.click(screen.getByRole("menuitemradio", { name: "Default" }));
        expect(onUpdate).toHaveBeenCalledWith("work", { color: "#0b8043" });

        await userEvent.click(screen.getByRole("button", { name: "Manage Work" }));
        await userEvent.click(screen.getByRole("button", { name: "Tomato" }));
        expect(onUpdate).toHaveBeenCalledWith("work", { color: "#c5221f" });

        await userEvent.click(screen.getByRole("button", { name: "Manage Work" }));
        await userEvent.click(screen.getByRole("menuitem", { name: "Settings and sharing" }));
        expect(screen.getByRole("heading", { name: "Calendar settings" })).toBeInTheDocument();
        expect(screen.getByTestId("calendar-name-input")).toHaveValue("Work");
    });

    test("keeps calendar options open and reports update failures", async () => {
        const calendar = { _id: "work", name: "Work", color: "#0b8043", defaultColor: "#0b8043", visible: true, isPrimary: false, description: "", timeZone: "UTC" };
        render(<CalendarSidebar calendars={[calendar]} collapsed={false} cursor={new Date(2026, 7, 27)} miniMonth={new Date(2026, 7, 1)} onCalendarCreate={vi.fn()} onCalendarDelete={vi.fn()} onCalendarDisplayOnly={vi.fn()} onCalendarUpdate={vi.fn().mockRejectedValue(new Error("Color update failed"))} onCreate={vi.fn()} onMiniMonthChange={vi.fn()} onSelectDate={vi.fn()} />);
        await userEvent.click(screen.getByRole("button", { name: "Manage Work" }));
        await userEvent.click(screen.getByRole("button", { name: "Tomato" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Color update failed");
        expect(screen.getByRole("menu", { name: "Work options" })).toBeInTheDocument();
    });
});

describe("calendar views", () => {
    const calendars = [{ _id: "calendar-1", name: "My calendar", color: "#1a73e8" }];
    const events = [{ _id: "event-1", calendarId: "calendar-1", title: "Planning", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false }];

    test("renders timed events in the day grid", () => {
        render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={events} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        const event = screen.getByRole("button", { name: /Planning/ });
        expect(event).toBeInTheDocument();
        expect(event.style.width).toBe("calc(100% - 24px)");
    });

    test("uses a compact one-line layout for short events", () => {
        const shortEvent = { ...events[0], endAt: "2026-08-27T10:30:00" };
        render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[shortEvent]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        expect(screen.getByRole("button", { name: /Planning/ })).toHaveAttribute("data-density", "micro");
    });

    test("keeps a scrolling week header aligned with its time grid", () => {
        const { container } = render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={7} events={[]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        const scroll = container.querySelector(".time-view-scroll");
        const header = container.querySelector(".time-view-header");
        scroll.scrollLeft = 240;
        fireEvent.scroll(scroll);
        expect(header.scrollLeft).toBe(240);
    });

    test("renders and selects a timed event that crosses midnight", async () => {
        const onEventSelect = vi.fn();
        const overnight = { _id: "overnight", calendarId: "calendar-1", title: "Overnight support", startAt: "2026-08-26T23:30:00", endAt: "2026-08-27T00:30:00", allDay: false };
        render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[overnight]} onCreate={vi.fn()} onEventSelect={onEventSelect} />);
        const segment = screen.getByRole("button", { name: /Overnight support/ });
        expect(segment).toBeInTheDocument();
        await userEvent.click(segment);
        expect(onEventSelect).toHaveBeenCalledWith(overnight);
    });

    test("renders a persisted working location beside the day badge", async () => {
        const onEventSelect = vi.fn();
        const office = { _id: "location-1", calendarId: "calendar-1", title: "Office", type: "workingLocation", startAt: "2026-08-27T00:00:00", endAt: "2026-08-28T00:00:00", allDay: true };
        render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[office]} onCreate={vi.fn()} onEventSelect={onEventSelect} />);
        await userEvent.click(screen.getByRole("button", { name: "Working location: Office" }));
        expect(onEventSelect).toHaveBeenCalledWith(office);
        expect(screen.queryByRole("button", { name: "Office" })).not.toBeInTheDocument();
    });

    test("opens a month date in day view", async () => {
        const onDaySelect = vi.fn();
        render(<MonthView calendars={calendars} cursor={new Date(2026, 7, 27)} events={events} onCreate={vi.fn()} onDaySelect={onDaySelect} onEventSelect={vi.fn()} />);
        await userEvent.click(screen.getByRole("button", { name: "Open August 27, 2026" }));
        expect(onDaySelect.mock.calls[0][0].getDate()).toBe(27);
    });

    test("does not create a second event when a month event is double-clicked", () => {
        const onCreate = vi.fn();
        const onEventSelect = vi.fn();
        render(<MonthView calendars={calendars} cursor={new Date(2026, 7, 27)} events={events} onCreate={onCreate} onDaySelect={vi.fn()} onEventSelect={onEventSelect} />);
        fireEvent.doubleClick(screen.getByRole("button", { name: /Planning/ }));
        expect(onCreate).not.toHaveBeenCalled();
    });

    test("shows overflow counts and continuation events in month view", () => {
        const manyEvents = Array.from({ length: 4 }, (_, index) => ({ ...events[0], _id: `event-${index}`, title: `Event ${index}` }));
        const overnight = { ...events[0], _id: "overnight", title: "Overnight", startAt: "2026-08-26T23:00:00", endAt: "2026-08-27T01:00:00" };
        render(<MonthView calendars={calendars} cursor={new Date(2026, 7, 27)} events={[overnight, ...manyEvents]} onCreate={vi.fn()} onDaySelect={vi.fn()} onEventSelect={vi.fn()} />);
        expect(screen.getByRole("button", { name: "+2 more" })).toBeInTheDocument();
        expect(screen.getByText("Continues")).toBeInTheDocument();
    });

    test("distinguishes an empty search result", () => {
        render(<SearchResults calendars={calendars} criteria={{ what: "missing" }} error="" loading={false} onClear={vi.fn()} onEventSelect={vi.fn()} results={[]} />);
        expect(screen.getByText("No results found")).toBeInTheDocument();
    });

    test("offers recovery after a search failure", async () => {
        const onClear = vi.fn();
        render(<SearchResults calendars={calendars} criteria={{ what: "planning" }} error="Network unavailable" loading={false} onClear={onClear} onEventSelect={vi.fn()} results={[]} />);
        expect(screen.getByRole("alert")).toHaveTextContent("Network unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Modify search" }));
        expect(onClear).toHaveBeenCalledOnce();
    });

    test("distinguishes loading and orders past and upcoming search sections", () => {
        const { rerender } = render(<SearchResults calendars={calendars} criteria={{ what: "planning" }} error="" loading onClear={vi.fn()} onEventSelect={vi.fn()} results={[]} />);
        expect(screen.getByRole("status")).toHaveTextContent("Searching events");
        const results = [
            { ...events[0], _id: "past", title: "Past planning", startAt: "2020-01-01T10:00:00Z", endAt: "2020-01-01T11:00:00Z" },
            { ...events[0], _id: "future", title: "Future planning", startAt: "2030-01-01T10:00:00Z", endAt: "2030-01-01T11:00:00Z" },
        ];
        rerender(<SearchResults calendars={calendars} criteria={{ what: "planning" }} error="" loading={false} onClear={vi.fn()} onEventSelect={vi.fn()} results={results} />);
        expect(screen.getByRole("heading", { name: "Upcoming" })).toBeInTheDocument();
        expect(screen.getByRole("heading", { name: "Past" })).toBeInTheDocument();
    });
});

describe("time insights", () => {
    const insights = {
        workingDayMinutes: 480,
        totalScheduledMinutes: 150,
        meetingMinutes: 60,
        averageDailyMeetingMinutes: 45,
        remainingMinutes: 330,
        categories: [
            { key: "meetings", label: "Meetings", color: "#1a73e8", minutes: 60 },
            { key: "focus", label: "Focus time", color: "#039be5", minutes: 90 },
            { key: "tasks", label: "Tasks", color: "#7e57c2", minutes: 0 },
            { key: "outOfOffice", label: "Out of office", color: "#f4511e", minutes: 0 },
        ],
        calendars: [{ calendarId: "calendar-1", name: "My calendar", color: "#1a73e8", minutes: 150 }],
    };

    test("shows the daily summary and opens detailed insights", async () => {
        const onOpen = vi.fn();
        render(<TimeInsightsSummary cursor={new Date(2026, 7, 27)} insights={insights} onOpen={onOpen} />);
        expect(screen.getByText("1 hr in meetings")).toBeInTheDocument();
        expect(screen.getByText("(avg: 0.8 hr)")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /More insights/ }));
        expect(onOpen).toHaveBeenCalledOnce();
    });

    test("switches the drawer breakdown and schedules focus time", async () => {
        const onClose = vi.fn();
        const onScheduleFocus = vi.fn();
        render(<TimeInsightsDrawer cursor={new Date(2026, 7, 27)} insights={insights} onClose={onClose} onScheduleFocus={onScheduleFocus} />);
        expect(screen.getByRole("dialog", { name: /Time Insights/ })).toBeInTheDocument();
        expect(document.activeElement).toHaveAccessibleName("Close time insights");
        expect(screen.getByText("Focus time")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "By calendar" }));
        expect(screen.getByText("My calendar")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: /Schedule focus time/ }));
        expect(onScheduleFocus).toHaveBeenCalledOnce();
        fireEvent.keyDown(document, { key: "Escape" });
        expect(onClose).toHaveBeenCalledOnce();
    });

    test("supports collapsed, loading, failure, retry, and zero-data insight states", async () => {
        const onRetry = vi.fn();
        const { rerender } = render(<TimeInsightsSummary cursor={new Date(2026, 7, 27)} loading onRetry={onRetry} />);
        expect(screen.getByRole("status", { name: "Loading time insights" })).toBeInTheDocument();
        rerender(<TimeInsightsSummary cursor={new Date(2026, 7, 27)} error="Offline" onRetry={onRetry} />);
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(onRetry).toHaveBeenCalledOnce();
        rerender(<TimeInsightsSummary cursor={new Date(2026, 7, 27)} insights={{ workingDayMinutes: 480, meetingMinutes: 0, averageDailyMeetingMinutes: 0 }} />);
        expect(screen.getByText("0 hr in meetings")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Time Insights" }));
        expect(screen.queryByRole("button", { name: "More insights" })).not.toBeInTheDocument();
    });
});
