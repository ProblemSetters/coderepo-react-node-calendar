import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { CalendarHeader } from "../src/features/calendar/CalendarHeader.jsx";
import { CalendarSidebar } from "../src/features/calendar/CalendarSidebar.jsx";
import { CalendarEditor } from "../src/features/calendar/CalendarEditor.jsx";
import { MiniCalendar } from "../src/features/calendar/MiniCalendar.jsx";
import { MonthView } from "../src/features/calendar/MonthView.jsx";
import { TimeGrid, hourHeight, timeGridLayers } from "../src/features/calendar/TimeGrid.jsx";
import { getEventColumnGeometry, layoutTimedEvents } from "../src/features/calendar/event-layout.js";
import { calendarColors, foregroundForColor, nextAvailableCalendarColor, overlapColor } from "../src/features/calendar/calendar-colors.js";
import { EventEditor } from "../src/features/events/EventEditor.jsx";
import { EventPreview } from "../src/features/events/EventPreview.jsx";
import { AdvancedSearchPanel } from "../src/features/events/AdvancedSearchPanel.jsx";
import { SearchResults } from "../src/features/events/SearchResults.jsx";
import { TimeInsightsDrawer } from "../src/features/insights/TimeInsightsDrawer.jsx";
import { TimeInsightsSummary } from "../src/features/insights/TimeInsightsSummary.jsx";
import { dateKey, formatHeading, formatTime, formatTimeZoneOffset, getViewRange, moveCursor, startOfWeek } from "../src/shared/utils/date.js";

const peopleMocks = vi.hoisted(() => ({ search: vi.fn() }));
const availabilityMocks = vi.hoisted(() => ({ conflicts: vi.fn() }));
vi.mock("../src/features/people/people.api.js", () => ({ peopleApi: { search: peopleMocks.search } }));
vi.mock("../src/features/people/availability.api.js", () => ({ availabilityApi: { conflicts: availabilityMocks.conflicts } }));

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
        await userEvent.click(screen.getByRole("combobox", { name: "Search in" }));
        await userEvent.click(screen.getByRole("option", { name: "All calendars" }));
        await userEvent.type(screen.getByPlaceholderText("Keywords contained in event"), "planning");
        await userEvent.type(screen.getByPlaceholderText("Enter a participant, organizer, or creator"), "Jordan Smith");
        await userEvent.type(screen.getByPlaceholderText("Enter a location or room"), "Cedar");
        await userEvent.type(screen.getByPlaceholderText("Keywords not contained in event"), "canceled");
        fireEvent.change(screen.getByLabelText("From date"), { target: { value: "2026-08-01" } });
        fireEvent.change(screen.getByLabelText("To date"), { target: { value: "2026-08-31" } });
        await userEvent.click(screen.getByRole("button", { name: "Search" }));
        expect(onSearch).toHaveBeenCalledWith(expect.objectContaining({ scope: "all", what: "planning", who: "Jordan Smith", where: "Cedar", exclude: "canceled", from: "2026-08-01", to: "2026-08-31" }));
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
        const firstColumn = getEventColumnGeometry(0, 2);
        const secondColumn = getEventColumnGeometry(1, 2);
        expect(firstColumn).toMatchObject({ left: 0, width: 50, zIndex: 2 });
        expect(secondColumn).toMatchObject({ left: 50, width: 50, zIndex: 2 });
        expect(firstColumn.left + firstColumn.width).toBeLessThanOrEqual(secondColumn.left);
        expect(overlapColor("#1a73e8", 0, 2)).toBe("#1a73e8");
        expect(overlapColor("#1a73e8", 1, 2)).toBe("#1869d3");
    });

    test("keeps adjacent and overlapping event cards visually distinct with visible task text", () => {
        const testCalendars = [{ _id: "calendar-1", name: "My calendar", color: "#1a73e8" }];
        const baseEvent = { calendarId: "calendar-1", type: "event", allDay: false };
        const adjacentAndOverlapping = [
            { ...baseEvent, _id: "first", title: "First meeting", startAt: "2026-08-27T09:00:00", endAt: "2026-08-27T10:00:00" },
            { ...baseEvent, _id: "second", title: "Second meeting", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00" },
            { ...baseEvent, _id: "overlap", title: "Overlapping meeting", startAt: "2026-08-27T10:30:00", endAt: "2026-08-27T11:30:00" },
            { ...baseEvent, _id: "task", title: "Visible task", type: "task", startAt: "2026-08-27T12:00:00", endAt: "2026-08-27T12:30:00" },
        ];
        render(<TimeGrid calendars={testCalendars} cursor={new Date(2026, 7, 27)} days={1} events={adjacentAndOverlapping} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        const first = screen.getByRole("button", { name: /First meeting/ });
        const second = screen.getByRole("button", { name: /Second meeting/ });
        const overlapping = screen.getByRole("button", { name: /Overlapping meeting/ });
        const task = screen.getByRole("button", { name: /Visible task/ });
        expect(first).toHaveStyle({ top: `${9 * hourHeight + 2}px`, height: `${hourHeight - 4}px` });
        expect(second).toHaveAttribute("data-overlap", "true");
        expect(second).toHaveAttribute("data-overlap-edge", "start");
        expect(overlapping).toHaveAttribute("data-overlap-column", "1");
        expect(overlapping).toHaveAttribute("data-overlap-edge", "end");
        expect(second).toHaveStyle({ left: "0%", width: "calc(50% - 12px)", zIndex: "2" });
        expect(overlapping).toHaveStyle({ left: "calc(50% - 12px)", width: "calc(50% - 12px)", zIndex: "2" });
        expect(second.style.getPropertyValue("--event-base-layer")).toBe("2");
        expect(second.style.backgroundColor).not.toBe(overlapping.style.backgroundColor);
        expect(second.style.borderColor).toBe(second.style.backgroundColor);
        expect(overlapping.style.borderColor).toBe(overlapping.style.backgroundColor);
        expect(task).toHaveTextContent("Visible task");
        expect(task).toHaveAttribute("data-item-type", "task");
    });

    test("partitions any simultaneous event count across the complete row", () => {
        const simultaneous = Array.from({ length: 5 }, (_, index) => ({
            calendarId: "calendar-1", _id: `parallel-${index}`, title: `Parallel ${index + 1}`, type: "event", allDay: false,
            startAt: "2026-08-27T15:30:00", endAt: "2026-08-27T16:30:00",
        }));
        const { container } = render(<TimeGrid calendars={[{ _id: "calendar-1", color: "#1a73e8" }]} cursor={new Date(2026, 7, 27)} days={1} events={simultaneous} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        const cards = [...container.querySelectorAll('.timed-event[data-overlap-count="5"]')];
        expect(cards).toHaveLength(5);
        cards.forEach((card, index) => {
            const inset = Number((index * 4.8).toFixed(4));
            expect(card).toHaveStyle({ left: index === 0 ? "0%" : `calc(${index * 20}% - ${inset}px)`, width: "calc(20% - 4.8px)", zIndex: "2" });
            expect(card).toHaveAttribute("data-crowded", "true");
            expect(card).toHaveAttribute("data-overlap-edge", index === 0 ? "start" : index === cards.length - 1 ? "end" : "middle");
            expect(card).toHaveAccessibleName(new RegExp(`Parallel ${index + 1}.*3:30 PM.*4:30 PM`));
        });
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
        expect(screen.getByRole("combobox", { name: "Repeat" })).toHaveTextContent("Does not repeat");
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
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "outOfOffice", cursor: new Date("2026-08-27T10:00:00"), participants: ["Jordan Smith", "Taylor Johnson"] }} onClose={vi.fn()} onSave={onSave} />);
        expect(screen.getByRole("button", { name: /Start date: Thursday, August 27/ })).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: /End date:/ })).not.toBeInTheDocument();
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Jordan Smith");
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Taylor Johnson");
        await userEvent.click(screen.getByTestId("save-event-button"));
        const payload = onSave.mock.calls[0][0];
        expect(payload).toEqual(expect.objectContaining({ allDay: true, participants: ["Jordan Smith", "Taylor Johnson"] }));
        expect(dateKey(payload.startAt)).toBe("2026-08-27");
        expect(dateKey(payload.endAt)).toBe("2026-08-28");
    });

    test("searches, selects, removes, and persists event guests", async () => {
        const sky = { _id: "person-1", name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#1a73e8" };
        const sage = { _id: "person-2", name: "Taylor Johnson", email: "taylor.johnson@calendar.com", avatarColor: "#0f9d58" };
        const onSave = vi.fn().mockResolvedValue(undefined);
        peopleMocks.search.mockResolvedValue([sky, sage]);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "outOfOffice", cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onSave={onSave} />);
        const search = screen.getByRole("textbox", { name: "Search guests" });
        await userEvent.click(search);
        await userEvent.click(await screen.findByRole("option", { name: /Jordan Smith/ }));
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Jordan Smith");
        await userEvent.click(search);
        expect(screen.queryByRole("option", { name: /Jordan Smith/ })).not.toBeInTheDocument();
        await userEvent.click(await screen.findByRole("option", { name: /Taylor Johnson/ }));
        await userEvent.click(screen.getByRole("button", { name: "Remove Jordan Smith" }));
        expect(screen.getByLabelText("Selected guests")).not.toHaveTextContent("Jordan Smith");
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: ["Taylor Johnson"] }));
    });

    test("warns about guest conflicts live and rechecks availability before save", async () => {
        const person = { _id: "64f000000000000000000001", name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#1a73e8" };
        const conflict = { person, busy: [{ title: "Design review", startAt: "2026-08-27T10:15:00.000Z", endAt: "2026-08-27T11:00:00.000Z" }] };
        const onSave = vi.fn().mockResolvedValue(undefined);
        peopleMocks.search.mockResolvedValue([person]);
        availabilityMocks.conflicts.mockResolvedValue({ available: false, conflicts: [conflict] });
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00"), title: "Planning" }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.click(screen.getByRole("textbox", { name: "Search guests" }));
        await userEvent.click(await screen.findByRole("option", { name: /Jordan Smith/ }));
        expect(await screen.findByText("Jordan Smith is unavailable")).toBeInTheDocument();
        expect(screen.getByText(/Jordan Smith: .*–/)).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(availabilityMocks.conflicts).toHaveBeenCalledTimes(2);
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ participants: ["Jordan Smith"], participantIds: [person._id] }));
    });

    test("warns without blocking when a free guest is outside working hours", async () => {
        const person = { _id: "64f000000000000000000001", name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#1a73e8", timeZone: "America/New_York", workingHours: { startMinute: 540, endMinute: 1020 } };
        const onSave = vi.fn().mockResolvedValue(undefined);
        peopleMocks.search.mockResolvedValue([person]);
        availabilityMocks.conflicts.mockResolvedValue({ available: true, conflicts: [], withinWorkingHours: false, workingHoursWarnings: [{ person, localDate: "2026-08-27", workingDay: true }] });
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T22:00:00"), title: "Late planning" }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.click(screen.getByRole("textbox", { name: "Search guests" }));
        await userEvent.click(await screen.findByRole("option", { name: /Jordan Smith/ }));
        expect(await screen.findByText("Outside working hours")).toBeInTheDocument();
        expect(screen.getByText(/Jordan Smith: .*America\/New York/)).toBeInTheDocument();
        availabilityMocks.conflicts.mockClear();
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(availabilityMocks.conflicts).toHaveBeenCalledTimes(1);
        expect(onSave).toHaveBeenCalled();
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

    test("confirms unsaved editor changes without leaving the app", async () => {
        const onClose = vi.fn();
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ type: "event", cursor: new Date("2026-08-27T10:00:00") }} onClose={onClose} onSave={vi.fn()} />);
        await userEvent.type(screen.getByTestId("event-title-input"), "Planning");
        await userEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
        const confirmation = screen.getByRole("dialog", { name: "Discard changes?" });
        expect(within(confirmation).getByText(/have not been saved/)).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
        await userEvent.click(within(confirmation).getByRole("button", { name: "Discard" }));
        expect(onClose).toHaveBeenCalledOnce();
    });

    test("shows deletion only while editing an existing owned event", async () => {
        const onDelete = vi.fn().mockResolvedValue(undefined);
        const calendars = [{ _id: "calendar-1", name: "My calendar", visible: true }];
        const existingEvent = { _id: "event-1", calendarId: "calendar-1", title: "Planning", type: "event", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false };
        const { unmount } = render(<EventEditor calendars={calendars} draft={existingEvent} onClose={vi.fn()} onDelete={onDelete} onSave={vi.fn()} />);
        const deleteButton = screen.getByRole("button", { name: "Delete event" });
        expect(deleteButton.querySelector("svg")).toBeInTheDocument();
        await userEvent.click(deleteButton);
        const confirmation = screen.getByRole("dialog", { name: "Delete event?" });
        await userEvent.click(within(confirmation).getByRole("button", { name: "Delete", exact: true }));
        expect(onDelete).toHaveBeenCalledOnce();

        unmount();
        render(<EventEditor calendars={calendars} draft={{ cursor: new Date("2026-08-27T10:00:00") }} onClose={vi.fn()} onDelete={onDelete} onSave={vi.fn()} />);
        expect(screen.queryByRole("button", { name: "Delete event" })).not.toBeInTheDocument();
    });

    test("keeps event deletion confirmation inside the app", async () => {
        const onDelete = vi.fn();
        const event = { _id: "event-1", title: "Planning", type: "task", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false, organizer: "Alex Morgan", location: "Cedar", description: "Plan launch" };
        render(<EventPreview calendar={{ name: "Work", color: "#1a73e8" }} event={event} onClose={vi.fn()} onDelete={onDelete} onEdit={vi.fn()} />);
        expect(screen.getByText("Task")).toBeInTheDocument();
        expect(screen.getByText("Alex Morgan")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Delete event" }));
        expect(screen.getByRole("heading", { name: "Delete event?" })).toBeInTheDocument();
        expect(onDelete).not.toHaveBeenCalled();
        await userEvent.click(screen.getByRole("button", { name: "Cancel", exact: true }));
        expect(screen.queryByRole("heading", { name: "Delete event?" })).not.toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Delete event" })).toBeInTheDocument();
    });

    test("offers accessible Yes, Maybe, and No controls only to invited attendees", async () => {
        const onRespond = vi.fn();
        const event = {
            _id: "event-1", title: "Planning", type: "event", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false,
            organizer: "Alex Morgan", editable: false, responseStatus: "needsAction", responseSummary: { needsAction: 1, accepted: 1, declined: 1, tentative: 1 },
            participantPeople: [
                { _id: "person-2", name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#1a73e8", responseStatus: "accepted" },
                { _id: "person-3", name: "Taylor Johnson", email: "taylor.johnson@calendar.com", avatarColor: "#d93025", responseStatus: "needsAction" },
                { _id: "person-4", name: "Riley Parker", email: "riley.parker@calendar.com", avatarColor: "#00796b", responseStatus: "declined" },
                { _id: "person-5", name: "Casey Bennett", email: "casey.bennett@calendar.com", avatarColor: "#7b1fa2", responseStatus: "tentative" },
            ],
        };
        const { rerender } = render(<EventPreview calendar={{ name: "Work", color: "#1a73e8" }} event={event} onClose={vi.fn()} onRespond={onRespond} />);
        expect(screen.getByText("4 guests")).toBeInTheDocument();
        for (const summary of ["1 yes", "1 no", "1 awaiting", "1 maybe"]) expect(screen.getByText(summary)).toBeInTheDocument();
        const guestDisclosure = screen.getByRole("button", { name: "Show guest details" });
        expect(guestDisclosure).toHaveAttribute("aria-expanded", "false");
        expect(screen.queryByText("jordan.smith@calendar.com")).not.toBeInTheDocument();
        await userEvent.click(guestDisclosure);
        expect(screen.getByRole("button", { name: "Hide guest details" })).toHaveAttribute("aria-expanded", "true");
        expect(screen.getByText("jordan.smith@calendar.com")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Hide guest details" }));
        for (const name of ["Yes, attending", "Maybe attending", "No, declining"]) expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
        await userEvent.click(screen.getByRole("button", { name: "Maybe attending" }));
        expect(onRespond).toHaveBeenCalledWith("tentative");

        rerender(<EventPreview calendar={{ name: "Work", color: "#1a73e8" }} event={{ ...event, editable: true, responseStatus: undefined }} onClose={vi.fn()} onDelete={vi.fn()} onEdit={vi.fn()} onRespond={onRespond} />);
        expect(screen.queryByText("Going?")).not.toBeInTheDocument();
        expect(screen.getByText("4 guests")).toBeInTheDocument();
    });

    test("asks for occurrence scope before responding to a recurring invitation", async () => {
        const onRespond = vi.fn().mockResolvedValue(undefined);
        const event = {
            _id: "series-1", occurrenceKey: "series-1:2026-08-27", occurrenceStartAt: "2026-08-27T10:00:00.000Z", recurring: true,
            title: "Daily planning", type: "event", startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z", allDay: false,
            organizer: "Alex Morgan", editable: false, responseStatus: "needsAction", recurrence: { frequency: "daily", interval: 1, endType: "never", timeZone: "UTC" },
        };
        render(<EventPreview calendar={{ name: "Work", color: "#1a73e8" }} event={event} onClose={vi.fn()} onRespond={onRespond} />);
        expect(screen.getAllByRole("button", { name: /attending|declining/ }).map((button) => button.getAttribute("aria-label"))).toEqual(["Yes, attending", "No, declining", "Maybe attending"]);
        await userEvent.click(screen.getByRole("button", { name: "No, declining" }));
        expect(screen.getByRole("heading", { name: "RSVP to recurring event" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("radio", { name: "All events" }));
        await userEvent.click(screen.getByRole("button", { name: "OK" }));
        expect(onRespond).toHaveBeenCalledWith("declined", { scope: "all", occurrenceStartAt: event.occurrenceStartAt });
    });

    test("saves Google-style repeat presets with the event", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00"), title: "Weekly planning" }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.click(screen.getByRole("combobox", { name: "Repeat" }));
        await userEvent.click(screen.getByRole("option", { name: /Weekly on/ }));
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ recurrence: expect.objectContaining({ frequency: "weekly", interval: 1, daysOfWeek: [4] }) }));
    });

    test("builds and saves a custom weekly recurrence with an occurrence limit", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00"), title: "Custom planning" }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.click(screen.getByRole("combobox", { name: "Repeat" }));
        await userEvent.click(screen.getByRole("option", { name: "Custom…" }));
        expect(screen.getByRole("dialog", { name: "Custom recurrence" })).toBeInTheDocument();
        expect(screen.getByRole("combobox", { name: "Repeat frequency" })).toHaveTextContent("week");
        await userEvent.click(screen.getByRole("button", { name: "Increase repeat interval" }));
        expect(screen.getByRole("combobox", { name: "Repeat frequency" })).toHaveTextContent("weeks");
        await userEvent.click(screen.getByRole("checkbox", { name: "M" }));
        await userEvent.click(screen.getByRole("radio", { name: /^After/ }));
        const occurrences = screen.getByRole("textbox", { name: "Number of occurrences" });
        await userEvent.clear(occurrences);
        await userEvent.type(occurrences, "1");
        expect(screen.getByText("occurrence", { exact: true })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Increase number of occurrences" }));
        expect(screen.getByText("occurrences", { exact: true })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Done" }));
        expect(screen.getByRole("combobox", { name: "Repeat" })).toHaveTextContent("Every 2 weeks on Monday, Thursday");
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ recurrence: expect.objectContaining({ frequency: "weekly", interval: 2, daysOfWeek: [1, 4], endType: "count", count: 2, until: null }) }));
    });

    test("uses the in-app calendar for a custom recurrence end date", async () => {
        const onSave = vi.fn().mockResolvedValue(undefined);
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00"), title: "Dated series" }} onClose={vi.fn()} onSave={onSave} />);
        await userEvent.click(screen.getByRole("combobox", { name: "Repeat" }));
        await userEvent.click(screen.getByRole("option", { name: "Custom…" }));
        await userEvent.click(screen.getByRole("radio", { name: /^On/ }));
        await userEvent.click(screen.getByRole("button", { name: /Recurrence end date/ }));
        expect(screen.getByRole("dialog", { name: "Choose recurrence end date" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Friday, August 28, 2026" }));
        await userEvent.click(screen.getByRole("button", { name: "Done" }));
        await userEvent.click(screen.getByTestId("save-event-button"));
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ recurrence: expect.objectContaining({ endType: "until", until: "2026-08-28", count: null }) }));
    });

    test("prevents a weekly custom recurrence with no selected weekdays", async () => {
        render(<EventEditor calendars={[{ _id: "calendar-1", name: "My calendar", visible: true }]} draft={{ cursor: new Date("2026-08-27T10:00:00"), title: "Invalid series" }} onClose={vi.fn()} onSave={vi.fn()} />);
        await userEvent.click(screen.getByRole("combobox", { name: "Repeat" }));
        await userEvent.click(screen.getByRole("option", { name: "Custom…" }));
        await userEvent.click(screen.getAllByRole("checkbox", { name: "T" }).find((checkbox) => checkbox.checked));
        expect(screen.getByRole("alert")).toHaveTextContent("Choose at least one day.");
        expect(screen.getByRole("button", { name: "Done" })).toBeDisabled();
    });

    test("marks declined invitations consistently across day and month views", () => {
        const invitation = { _id: "event-declined", calendarId: "calendar-1", title: "Declined meeting", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false, responseStatus: "declined" };
        const calendars = [{ _id: "calendar-1", color: "#1a73e8" }];
        const day = render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[invitation]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        expect(day.getByRole("button", { name: /Declined meeting/ })).toHaveAttribute("data-response-status", "declined");
        day.unmount();
        render(<MonthView calendars={calendars} cursor={new Date(2026, 7, 27)} events={[invitation]} onCreate={vi.fn()} onDaySelect={vi.fn()} onEventSelect={vi.fn()} />);
        expect(screen.getByRole("button", { name: /Declined meeting/ })).toHaveAttribute("data-response-status", "declined");
    });

    test("renders pending invitations outlined and accepted invitations filled", () => {
        const calendars = [{ _id: "calendar-1", color: "#1a73e8" }];
        const base = { _id: "invitation", calendarId: "calendar-1", title: "Planning", startAt: "2026-08-27T10:00:00", endAt: "2026-08-27T11:00:00", allDay: false };
        const { rerender } = render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[{ ...base, responseStatus: "needsAction" }]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        const outlinedEvent = screen.getByRole("button", { name: /Planning/ });
        expect(outlinedEvent.style.backgroundColor).toBe("var(--surface)");
        expect(outlinedEvent).toHaveStyle({ borderColor: "#1a73e8" });
        expect(getComputedStyle(outlinedEvent).borderWidth).toBe("1px");
        rerender(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[{ ...base, responseStatus: "accepted" }]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        expect(screen.getByRole("button", { name: /Planning/ })).toHaveStyle({ backgroundColor: "#1a73e8" });
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

    test("confirms calendar deletion in-app and preserves the editor on failure", async () => {
        const calendar = { _id: "work", name: "Work", color: "#0b8043", visible: true, isPrimary: false, description: "", timeZone: "UTC" };
        const onDelete = vi.fn().mockRejectedValue(new Error("Calendar still contains events."));
        render(<CalendarEditor calendar={calendar} onClose={vi.fn()} onDelete={onDelete} onSave={vi.fn()} />);
        const deleteButton = screen.getByRole("button", { name: "Delete", exact: true });
        expect(deleteButton.querySelector("svg")).toBeInTheDocument();
        await userEvent.click(deleteButton);
        const confirmation = screen.getByRole("dialog", { name: "Delete calendar?" });
        expect(within(confirmation).getByText(/Only empty calendars/)).toBeInTheDocument();
        await userEvent.click(within(confirmation).getByRole("button", { name: "Delete", exact: true }));
        expect(await screen.findByRole("alert")).toHaveTextContent("still contains events");
        expect(screen.getByRole("heading", { name: "Calendar settings" })).toBeInTheDocument();
        expect(screen.queryByRole("dialog", { name: "Delete calendar?" })).not.toBeInTheDocument();
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

    test("keeps the current-time marker above hovered and focused events without intercepting input", () => {
        const { container } = render(<TimeGrid calendars={calendars} cursor={new Date()} days={1} events={[]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        const column = container.querySelector(".time-column");
        expect(timeGridLayers.currentTime).toBeGreaterThan(timeGridLayers.eventHover);
        expect(column.style.getPropertyValue("--event-hover-layer")).toBe(String(timeGridLayers.eventHover));
        expect(column.style.getPropertyValue("--current-time-layer")).toBe(String(timeGridLayers.currentTime));
        expect(container.querySelector(".current-time")).toBeInTheDocument();
    });

    test("renders timed events in the day grid", () => {
        const { container } = render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={events} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        const event = screen.getByRole("button", { name: /Planning/ });
        expect(event).toBeInTheDocument();
        expect(event.style.width).toBe("calc(100% - 24px)");
        expect(container.querySelector(".time-view-header")).toHaveClass("empty-all-day");
    });

    test("keeps the full all-day lane when an all-day event is visible", () => {
        const allDay = { ...events[0], _id: "holiday", title: "Holiday", allDay: true, startAt: "2026-08-27T00:00:00", endAt: "2026-08-28T00:00:00" };
        const { container } = render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[allDay]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        expect(container.querySelector(".time-view-header")).toHaveClass("has-all-day-events");
        expect(screen.getByRole("button", { name: /Holiday/ })).toBeInTheDocument();
    });

    test("uses a compact one-line layout for short events", () => {
        const shortEvent = { ...events[0], endAt: "2026-08-27T10:30:00" };
        render(<TimeGrid calendars={calendars} cursor={new Date(2026, 7, 27)} days={1} events={[shortEvent]} onCreate={vi.fn()} onEventSelect={vi.fn()} />);
        expect(screen.getByRole("button", { name: /Planning/ })).toHaveAttribute("data-density", "micro");
    });

    test("uses the dedicated out-of-office treatment in day, week, and month views", () => {
        const away = { ...events[0], _id: "away", title: "Out of office", type: "outOfOffice", startAt: "2026-08-27T18:30:00", endAt: "2026-08-27T23:59:00" };
        const props = { calendars, cursor: new Date(2026, 7, 27), events: [away], onCreate: vi.fn(), onEventSelect: vi.fn() };
        const { container, rerender } = render(<TimeGrid {...props} days={1} />);
        expect(screen.getByRole("button", { name: /Out of office/ })).toHaveAttribute("data-item-type", "outOfOffice");
        expect(container.querySelector(".out-of-office-icon")).toBeInTheDocument();
        rerender(<TimeGrid {...props} days={7} />);
        expect(container.querySelector('.timed-event[data-item-type="outOfOffice"] .out-of-office-icon')).toBeInTheDocument();
        rerender(<MonthView {...props} onDaySelect={vi.fn()} />);
        expect(container.querySelector('.month-event[data-item-type="outOfOffice"] .out-of-office-icon')).toBeInTheDocument();
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

    test("opens month overflow in a day popover and navigates only from its date", async () => {
        const manyEvents = Array.from({ length: 4 }, (_, index) => ({ ...events[0], _id: `event-${index}`, title: `Event ${index}` }));
        const overnight = { ...events[0], _id: "overnight", title: "Overnight", startAt: "2026-08-26T23:00:00", endAt: "2026-08-27T01:00:00" };
        const onDaySelect = vi.fn();
        const onEventSelect = vi.fn();
        render(<MonthView calendars={calendars} cursor={new Date(2026, 7, 27)} events={[overnight, ...manyEvents]} onCreate={vi.fn()} onDaySelect={onDaySelect} onEventSelect={onEventSelect} />);
        expect(screen.getByText("Continues")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "+2 more" }));
        const popover = screen.getByRole("dialog", { name: "Events on August 27, 2026" });
        expect(popover).toHaveStyle({ width: "292px" });
        expect(onDaySelect).not.toHaveBeenCalled();
        expect(within(popover).getAllByRole("button")).toHaveLength(7);
        await userEvent.click(within(popover).getByRole("button", { name: /Event 3/ }));
        expect(onEventSelect).toHaveBeenCalledWith(expect.objectContaining({ title: "Event 3" }));
        await userEvent.click(screen.getByRole("button", { name: "+2 more" }));
        await userEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Open Thursday, August 27 in day view" }));
        expect(onDaySelect).toHaveBeenCalledWith(expect.any(Date));
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
