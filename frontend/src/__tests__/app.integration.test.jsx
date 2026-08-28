import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
    calendarCreate: vi.fn(),
    calendarDisplayOnly: vi.fn(),
    calendarList: vi.fn(),
    calendarRemove: vi.fn(),
    calendarUpdate: vi.fn(),
    eventCreate: vi.fn(),
    eventList: vi.fn(),
    eventRemove: vi.fn(),
    eventSearch: vi.fn(),
    eventUpdate: vi.fn(),
    insightDaily: vi.fn(),
    peopleSearch: vi.fn(),
    profileList: vi.fn(),
    availabilitySuggestions: vi.fn(),
}));

vi.mock("../features/calendar/calendar.api.js", () => ({ calendarApi: { create: mocks.calendarCreate, displayOnly: mocks.calendarDisplayOnly, list: mocks.calendarList, remove: mocks.calendarRemove, update: mocks.calendarUpdate } }));
vi.mock("../features/events/event.api.js", () => ({ eventApi: { create: mocks.eventCreate, list: mocks.eventList, remove: mocks.eventRemove, search: mocks.eventSearch, update: mocks.eventUpdate } }));
vi.mock("../features/insights/insight.api.js", () => ({ insightApi: { daily: mocks.insightDaily } }));
vi.mock("../features/people/people.api.js", () => ({ peopleApi: { search: mocks.peopleSearch } }));
vi.mock("../features/people/availability.api.js", () => ({ availabilityApi: { suggestions: mocks.availabilitySuggestions, conflicts: vi.fn().mockResolvedValue({ available: true, conflicts: [] }) } }));
vi.mock("../features/profiles/profile.api.js", () => ({ profileApi: { list: mocks.profileList } }));

import App from "../App.jsx";

const calendars = [
    { _id: "calendar-1", name: "My calendar", color: "#1a73e8", visible: true, isPrimary: true },
    { _id: "calendar-2", name: "Work", color: "#0f9d58", visible: true, isPrimary: false },
];
const eventStart = new Date();
eventStart.setHours(10, 0, 0, 0);
const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);
const events = [{ _id: "event-1", calendarId: "calendar-1", title: "Design review", type: "event", startAt: eventStart.toISOString(), endAt: eventEnd.toISOString(), allDay: false, location: "Cedar" }];
const insights = { workingDayMinutes: 480, totalScheduledMinutes: 60, meetingMinutes: 60, averageDailyMeetingMinutes: 10, remainingMinutes: 420, categories: [], calendars: [] };
const diya = { _id: "person-1", name: "Diya Shah", email: "diya@example.com", avatarColor: "#d93025" };
const activeProfile = { _id: "profile-1", name: "Mahadevan M", email: "mahadevan@example.com", avatarColor: "#039be5", headline: "Product & engineering" };

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    localStorage.setItem("calendar-profile-id", activeProfile._id);
    window.matchMedia = vi.fn().mockReturnValue({ matches: false });
    mocks.calendarList.mockResolvedValue(calendars.map((calendar) => ({ ...calendar })));
    mocks.calendarUpdate.mockImplementation(async (id, values) => ({ ...calendars.find((calendar) => calendar._id === id), ...values }));
    mocks.calendarCreate.mockImplementation(async (values) => ({ _id: "calendar-new", visible: true, isPrimary: false, ...values }));
    mocks.calendarDisplayOnly.mockResolvedValue(calendars);
    mocks.calendarRemove.mockResolvedValue(null);
    mocks.eventList.mockResolvedValue(events);
    mocks.eventCreate.mockResolvedValue({ _id: "event-new" });
    mocks.eventUpdate.mockResolvedValue(events[0]);
    mocks.eventRemove.mockResolvedValue(null);
    mocks.eventSearch.mockResolvedValue(events);
    mocks.insightDaily.mockResolvedValue(insights);
    mocks.peopleSearch.mockResolvedValue([diya]);
    mocks.profileList.mockResolvedValue([activeProfile, diya]);
    mocks.availabilitySuggestions.mockResolvedValue({
        owner: { name: "You", busy: [] }, participants: [{ person: diya, busy: [] }],
        suggestions: [{ startAt: "2026-08-28T05:30:00.000Z", endAt: "2026-08-28T06:00:00.000Z", attendeeCount: 2 }],
    });
});

describe("application orchestration", () => {
    test("enters through a profile picker and can switch profiles from the header", async () => {
        localStorage.removeItem("calendar-profile-id");
        render(<App />);
        expect(await screen.findByRole("heading", { name: "Who’s using Calendar?" })).toBeInTheDocument();
        expect(screen.queryByText("Product & engineering")).not.toBeInTheDocument();
        expect(screen.queryByText(/Demo profiles keep/i)).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Continue as Mahadevan M" }));
        expect(await screen.findByRole("button", { name: /Design review/ })).toBeInTheDocument();
        expect(localStorage.getItem("calendar-profile-id")).toBe(activeProfile._id);
        await userEvent.click(screen.getByRole("button", { name: "Mahadevan M profile" }));
        await userEvent.click(screen.getByRole("menuitem", { name: "Switch profile" }));
        expect(await screen.findByRole("heading", { name: "Who’s using Calendar?" })).toBeInTheDocument();
        expect(localStorage.getItem("calendar-profile-id")).toBeNull();
    });

    test("offers a retry when profile discovery fails", async () => {
        localStorage.removeItem("calendar-profile-id");
        mocks.profileList.mockRejectedValueOnce(new Error("Profiles unavailable")).mockResolvedValueOnce([activeProfile]);
        render(<App />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Profiles unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByRole("button", { name: "Continue as Mahadevan M" })).toBeInTheDocument();
    });

    test("handles empty profiles and clears a stale saved profile", async () => {
        localStorage.setItem("calendar-profile-id", "profile-that-no-longer-exists");
        mocks.profileList.mockResolvedValue([]);
        render(<App />);
        expect(await screen.findByText("No demo profiles are available.")).toBeInTheDocument();
        await waitFor(() => expect(localStorage.getItem("calendar-profile-id")).toBeNull());
        expect(screen.queryByRole("button", { name: /Continue as/ })).not.toBeInTheDocument();
    });

    test("keeps header menus exclusive and restores focus when Escape closes the profile menu", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        const profileButton = screen.getByRole("button", { name: "Mahadevan M profile" });
        await userEvent.click(profileButton);
        expect(screen.getByRole("menu", { name: "Profile menu" })).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");
        expect(screen.queryByRole("menu", { name: "Profile menu" })).not.toBeInTheDocument();
        expect(profileButton).toHaveFocus();

        await userEvent.click(screen.getByRole("button", { name: "Calendar view" }));
        expect(screen.getByRole("menu", { name: "Calendar views" })).toBeInTheDocument();
        await userEvent.click(profileButton);
        expect(screen.queryByRole("menu", { name: "Calendar views" })).not.toBeInTheDocument();
        expect(screen.getByRole("menu", { name: "Profile menu" })).toBeInTheDocument();
        await userEvent.click(screen.getByTestId("today-button"));
        expect(screen.queryByRole("menu", { name: "Profile menu" })).not.toBeInTheDocument();
    });

    test("loads persisted data and refreshes when calendar visibility changes", async () => {
        localStorage.setItem("calendar-view", "day");
        render(<App />);
        expect(await screen.findByRole("button", { name: /Design review/ })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("checkbox", { name: "My calendar" }));
        expect(mocks.calendarUpdate).toHaveBeenCalledWith("calendar-1", { visible: false });
        await waitFor(() => expect(mocks.eventList.mock.calls.at(-1)[2]).toEqual(["calendar-2"]));
    });

    test("recovers after an initial calendar API failure", async () => {
        mocks.calendarList.mockRejectedValueOnce(new Error("Calendar API unavailable")).mockResolvedValueOnce(calendars);
        render(<App />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Calendar API unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByRole("checkbox", { name: "My calendar" })).toBeChecked();
        await waitFor(() => expect(mocks.eventList).toHaveBeenCalled());
    });

    test("runs compact search and opens the selected result", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        await userEvent.click(screen.getByRole("button", { name: "Search events" }));
        expect(screen.queryByPlaceholderText("Keywords contained in event")).not.toBeInTheDocument();
        await userEvent.type(screen.getByRole("textbox", { name: "Search" }), "Design{Enter}");
        expect(await screen.findByText(/Results for/)).toBeInTheDocument();
        expect(mocks.eventSearch).toHaveBeenCalledWith(expect.objectContaining({ what: "Design" }), ["calendar-1", "calendar-2"]);
        await userEvent.click(screen.getByRole("button", { name: /Design review/ }));
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    test("surfaces delete failures inside the open event preview", async () => {
        mocks.eventRemove.mockRejectedValue(new Error("Delete could not be completed"));
        render(<App />);
        await userEvent.click(await screen.findByRole("button", { name: /Design review/ }));
        await userEvent.click(screen.getByRole("button", { name: "Delete event" }));
        const alerts = await screen.findAllByRole("alert");
        expect(alerts.some((alert) => alert.textContent.includes("Delete could not be completed"))).toBe(true);
        expect(screen.getByRole("dialog")).toBeInTheDocument();
    });

    test("replaces the event preview with the editor and closes the complete flow after save", async () => {
        localStorage.setItem("calendar-view", "day");
        render(<App />);
        await userEvent.click(await screen.findByRole("button", { name: /Design review/ }));
        expect(screen.getByRole("button", { name: "Edit event" })).toBeInTheDocument();

        await userEvent.click(screen.getByRole("button", { name: "Edit event" }));
        expect(screen.queryByRole("button", { name: "Edit event" })).not.toBeInTheDocument();
        expect(screen.getAllByRole("dialog")).toHaveLength(1);
        expect(screen.getByTestId("event-title-input")).toHaveValue("Design review");

        await userEvent.click(screen.getByTestId("save-event-button"));
        await waitFor(() => expect(mocks.eventUpdate).toHaveBeenCalledWith("event-1", expect.objectContaining({ title: "Design review" })));
        await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    });

    test("persists view and sidebar keyboard preferences", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        fireEvent.keyDown(window, { key: "m" });
        expect(localStorage.getItem("calendar-view")).toBe("month");
        expect(screen.getByTestId("view-select")).toHaveTextContent("Month");
        await userEvent.click(screen.getByRole("button", { name: "Toggle sidebar" }));
        expect(localStorage.getItem("calendar-sidebar")).toBe("collapsed");
        expect(screen.queryByTestId("create-event-button")).not.toBeInTheDocument();
    });

    test("creates an event and refreshes events and insights", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        await userEvent.click(screen.getByTestId("create-event-button"));
        await userEvent.click(screen.getByRole("menuitem", { name: "Event" }));
        await userEvent.type(screen.getByTestId("event-title-input"), "Release plan");
        await userEvent.click(screen.getByTestId("save-event-button"));
        await waitFor(() => expect(mocks.eventCreate).toHaveBeenCalledWith(expect.objectContaining({ title: "Release plan", type: "event" })));
        await waitFor(() => expect(mocks.eventList.mock.calls.length).toBeGreaterThan(1));
        expect(mocks.insightDaily.mock.calls.length).toBeGreaterThan(1);
    });

    test("creates a participant-prefilled event from a suggested time", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        const peopleSearch = screen.getByRole("textbox", { name: "Search for people" });
        await userEvent.click(peopleSearch);
        await userEvent.type(peopleSearch, "Diya");
        await userEvent.click(await screen.findByRole("option", { name: /Diya Shah/ }));
        await userEvent.click(screen.getByRole("button", { name: "Suggested times" }));
        expect(await screen.findByRole("dialog", { name: "Suggested times" })).toBeInTheDocument();
        await waitFor(() => expect(mocks.availabilitySuggestions).toHaveBeenCalledWith(expect.objectContaining({ participantIds: ["person-1"], durationMinutes: 30 })));
        await userEvent.click(await screen.findByRole("button", { name: /2 available/ }));
        expect(screen.getByTestId("event-title-input")).toHaveValue("Meeting with Diya Shah");
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Diya Shah");
        await userEvent.click(screen.getByTestId("save-event-button"));
        await waitFor(() => expect(mocks.eventCreate).toHaveBeenCalledWith(expect.objectContaining({ participants: ["Diya Shah"], startAt: "2026-08-28T05:30:00.000Z", endAt: "2026-08-28T06:00:00.000Z" })));
    });

    test("opens another person's comparison event as read-only details", async () => {
        mocks.availabilitySuggestions.mockResolvedValue({
            owner: { name: "You", busy: [] },
            participants: [{ person: diya, busy: [{ _id: "diya-event", title: "Design critique", description: "Review the new flow.", location: "Studio", type: "event", startAt: "2026-08-28T09:00:00.000Z", endAt: "2026-08-28T10:00:00.000Z" }] }],
            suggestions: [],
        });
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        const peopleSearch = screen.getByRole("textbox", { name: "Search for people" });
        await userEvent.click(peopleSearch);
        await userEvent.type(peopleSearch, "Diya");
        await userEvent.click(await screen.findByRole("option", { name: /Diya Shah/ }));
        await userEvent.click(await screen.findByRole("button", { name: /Design critique.*Diya Shah/ }));
        expect(screen.getByRole("dialog")).toHaveTextContent("Design critique");
        expect(screen.getByRole("dialog")).toHaveTextContent("Organized by Diya Shah");
        expect(screen.getByRole("dialog")).toHaveTextContent("Studio");
        expect(screen.getByRole("dialog")).toHaveTextContent("Review the new flow.");
        expect(screen.queryByRole("button", { name: "Edit event" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Delete event" })).not.toBeInTheDocument();
        expect(screen.queryByTestId("event-title-input")).not.toBeInTheDocument();
    });
});
