import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
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
    eventRespond: vi.fn(),
    eventSearch: vi.fn(),
    eventUpdate: vi.fn(),
    insightDaily: vi.fn(),
    peopleSearch: vi.fn(),
    profileList: vi.fn(),
    availabilitySuggestions: vi.fn(),
    authLogin: vi.fn(),
    authLogout: vi.fn(),
    authSession: vi.fn(),
    authSwitchProfile: vi.fn(),
}));

vi.mock("../src/features/calendar/calendar.api.js", () => ({ calendarApi: { create: mocks.calendarCreate, displayOnly: mocks.calendarDisplayOnly, list: mocks.calendarList, remove: mocks.calendarRemove, update: mocks.calendarUpdate } }));
vi.mock("../src/features/events/event.api.js", () => ({ eventApi: { create: mocks.eventCreate, list: mocks.eventList, remove: mocks.eventRemove, respond: mocks.eventRespond, search: mocks.eventSearch, update: mocks.eventUpdate } }));
vi.mock("../src/features/insights/insight.api.js", () => ({ insightApi: { daily: mocks.insightDaily } }));
vi.mock("../src/features/people/people.api.js", () => ({ peopleApi: { search: mocks.peopleSearch } }));
vi.mock("../src/features/people/availability.api.js", () => ({ availabilityApi: { suggestions: mocks.availabilitySuggestions, conflicts: vi.fn().mockResolvedValue({ available: true, conflicts: [] }) } }));
vi.mock("../src/features/profiles/profile.api.js", () => ({ profileApi: { list: mocks.profileList } }));
vi.mock("../src/features/auth/auth.api.js", () => ({ authApi: { login: mocks.authLogin, logout: mocks.authLogout, session: mocks.authSession, switchProfile: mocks.authSwitchProfile } }));

import App from "../src/App.jsx";
import { identityInitials } from "../src/shared/utils/identity.js";
import { setProfileToken, setSessionToken } from "../src/shared/api/client.js";

const calendars = [
    { _id: "calendar-1", name: "My calendar", color: "#1a73e8", visible: true, isPrimary: true },
    { _id: "calendar-2", name: "Work", color: "#0f9d58", visible: true, isPrimary: false },
];
const eventStart = new Date();
eventStart.setHours(10, 0, 0, 0);
const eventEnd = new Date(eventStart.getTime() + 60 * 60 * 1000);
const events = [{ _id: "event-1", calendarId: "calendar-1", title: "Design review", type: "event", startAt: eventStart.toISOString(), endAt: eventEnd.toISOString(), allDay: false, location: "Cedar" }];
const insights = { workingDayMinutes: 480, totalScheduledMinutes: 60, meetingMinutes: 60, averageDailyMeetingMinutes: 10, remainingMinutes: 420, categories: [], calendars: [] };
const participant = { _id: "person-1", name: "Taylor Johnson", email: "taylor.johnson@calendar.com", avatarColor: "#d93025" };
const activeProfile = { _id: "profile-1", name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5" };

beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    setSessionToken("workspace-token");
    setProfileToken("profile-token-profile-1");
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
    mocks.eventRespond.mockImplementation(async (id, status) => ({ ...events[0], editable: false, responseStatus: status, responseSummary: { needsAction: 0, accepted: status === "accepted" ? 1 : 0, declined: status === "declined" ? 1 : 0, tentative: status === "tentative" ? 1 : 0 }, participantPeople: [{ ...activeProfile, responseStatus: status }] }));
    mocks.eventSearch.mockResolvedValue(events);
    mocks.insightDaily.mockResolvedValue(insights);
    mocks.peopleSearch.mockResolvedValue([participant]);
    mocks.profileList.mockResolvedValue([activeProfile, participant]);
    mocks.authSession.mockResolvedValue({ account: { _id: "account-1", name: "Alex Morgan", email: "alex.morgan@calendar.com" } });
    mocks.authLogin.mockResolvedValue({ account: { _id: "account-1", name: "Alex Morgan", email: "alex.morgan@calendar.com" }, token: "workspace-token" });
    mocks.authSwitchProfile.mockImplementation(async (profileId) => ({ profile: [activeProfile, participant].find((profile) => profile._id === profileId), token: `profile-token-${profileId}` }));
    mocks.authLogout.mockResolvedValue(null);
    mocks.availabilitySuggestions.mockResolvedValue({
        owner: { name: "You", busy: [] }, participants: [{ person: participant, busy: [] }],
        suggestions: [{ startAt: "2026-08-28T05:30:00.000Z", endAt: "2026-08-28T06:00:00.000Z", attendeeCount: 2 }],
    });
});

describe("application orchestration", () => {
    test("creates stable initials for neutral profile names", () => {
        expect(["Alex Morgan", "Jordan Smith", "Taylor Johnson", "Riley Parker", "Casey Bennett"].map(identityInitials)).toEqual(["AM", "JS", "TJ", "RP", "CB"]);
    });

    test("signs in and opens the calendar of the person who signed in", async () => {
        localStorage.clear(); setSessionToken(""); setProfileToken("");
        render(<App />);
        expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
        expect(screen.getByTestId("password-input")).toHaveAttribute("type", "text");
        expect(screen.getByTestId("password-input")).toHaveAttribute("autocomplete", "off");
        expect(screen.getByTestId("password-input")).toHaveClass("workspace-password-input");
        await userEvent.type(screen.getByTestId("email-input"), "alex.morgan@calendar.com");
        await userEvent.type(screen.getByTestId("password-input"), "password123");
        await userEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(mocks.authLogin).toHaveBeenCalledWith("alex.morgan@calendar.com", "password123");
        expect(await screen.findByRole("button", { name: "Alex Morgan profile" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Choose an account" })).not.toBeInTheDocument();
        expect(localStorage.getItem("calendar-session-token")).toBe("workspace-token");
        expect(localStorage.getItem("calendar-profile-id")).toBe(activeProfile._id);
    });

    test("restores a saved workspace without flashing login or profile screens", async () => {
        let finishSession;
        let finishProfiles;
        mocks.authSession.mockReturnValue(new Promise((resolve) => { finishSession = resolve; }));
        mocks.profileList.mockReturnValue(new Promise((resolve) => { finishProfiles = resolve; }));
        render(<App />);
        expect(screen.getByRole("status", { name: "Opening Calendar" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Sign in" })).not.toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Choose an account" })).not.toBeInTheDocument();

        await act(async () => { finishSession({ account: { _id: "account-1", name: "Alex Morgan", email: "alex.morgan@calendar.com" } }); });
        await waitFor(() => expect(mocks.profileList).toHaveBeenCalledTimes(1));
        expect(screen.getByRole("status", { name: "Opening Calendar" })).toBeInTheDocument();
        expect(screen.queryByRole("heading", { name: "Choose an account" })).not.toBeInTheDocument();

        await act(async () => { finishProfiles([activeProfile, participant]); });
        expect(await screen.findByRole("button", { name: /Design review/ })).toBeInTheDocument();
        expect(screen.queryByRole("status", { name: "Opening Calendar" })).not.toBeInTheDocument();
    });

    test("keeps a calendar-shaped loading surface while workspace data hydrates", async () => {
        let finishCalendars;
        mocks.calendarList.mockReturnValue(new Promise((resolve) => { finishCalendars = resolve; }));
        render(<App />);
        expect(await screen.findByRole("status", { name: "Loading calendar" })).toBeInTheDocument();
        expect(screen.queryByText("Loading calendar…")).not.toBeInTheDocument();
        await act(async () => { finishCalendars(calendars); });
        expect(await screen.findByRole("button", { name: /Design review/ })).toBeInTheDocument();
    });

    test("keeps the login available after invalid credentials", async () => {
        localStorage.clear(); setSessionToken(""); setProfileToken("");
        mocks.authLogin.mockRejectedValueOnce(new Error("Email or password is incorrect."));
        render(<App />);
        await userEvent.type(await screen.findByTestId("email-input"), "alex.morgan@calendar.com");
        await userEvent.type(screen.getByTestId("password-input"), "wrong-password");
        await userEvent.click(screen.getByRole("button", { name: "Next" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Email or password is incorrect.");
        expect(screen.getByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    });

    test("enters through a profile picker and can switch profiles from the header", async () => {
        localStorage.removeItem("calendar-profile-id");
        render(<App />);
        expect(await screen.findByRole("heading", { name: "Choose an account" })).toBeInTheDocument();
        expect(screen.queryByText("Product & engineering")).not.toBeInTheDocument();
        expect(screen.queryByText(/Demo profiles keep/i)).not.toBeInTheDocument();
        await userEvent.click(await screen.findByRole("button", { name: "Continue as Alex Morgan" }));
        expect(await screen.findByRole("button", { name: /Design review/ })).toBeInTheDocument();
        expect(localStorage.getItem("calendar-profile-id")).toBe(activeProfile._id);
        await userEvent.click(screen.getByRole("button", { name: "Alex Morgan profile" }));
        await userEvent.click(screen.getByRole("menuitem", { name: "Switch profile" }));
        expect(await screen.findByRole("heading", { name: "Choose an account" })).toBeInTheDocument();
        expect(localStorage.getItem("calendar-profile-id")).toBeNull();
    });

    test("signs out directly from the active profile menu", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        await userEvent.click(screen.getByRole("button", { name: "Alex Morgan profile" }));
        await userEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));
        expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
        expect(mocks.authLogout).toHaveBeenCalledTimes(1);
        expect(localStorage.getItem("calendar-profile-id")).toBeNull();
    });

    test("offers a retry when profile discovery fails", async () => {
        localStorage.removeItem("calendar-profile-id");
        mocks.profileList.mockRejectedValueOnce(new Error("Profiles unavailable")).mockResolvedValueOnce([activeProfile]);
        render(<App />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Profiles unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByRole("button", { name: "Continue as Alex Morgan" })).toBeInTheDocument();
    });

    test("handles empty profiles and clears a stale saved profile", async () => {
        localStorage.setItem("calendar-profile-id", "profile-that-no-longer-exists");
        mocks.profileList.mockResolvedValue([]);
        render(<App />);
        expect(await screen.findByText("No accounts are available.")).toBeInTheDocument();
        await waitFor(() => expect(localStorage.getItem("calendar-profile-id")).toBeNull());
        expect(screen.queryByRole("button", { name: /Continue as/ })).not.toBeInTheDocument();
    });

    test("keeps header menus exclusive and restores focus when Escape closes the profile menu", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        const profileButton = screen.getByRole("button", { name: "Alex Morgan profile" });
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

    test("opens advanced search filters from the application header", async () => {
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        await userEvent.click(screen.getByRole("button", { name: "Search events" }));
        await userEvent.click(screen.getByRole("button", { name: "Show search options" }));
        expect(screen.getByRole("combobox", { name: "Search in" })).toBeInTheDocument();
    });

    test("surfaces delete failures inside the open event preview", async () => {
        mocks.eventRemove.mockRejectedValue(new Error("Delete could not be completed"));
        render(<App />);
        await userEvent.click(await screen.findByRole("button", { name: /Design review/ }));
        await userEvent.click(screen.getByRole("button", { name: "Delete event" }));
        expect(screen.getByRole("heading", { name: "Delete event?" })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Delete", exact: true }));
        const alerts = await screen.findAllByRole("alert");
        expect(alerts.some((alert) => alert.textContent.includes("Delete could not be completed"))).toBe(true);
        expect(screen.getByRole("dialog", { name: "Delete event?" })).toBeInTheDocument();
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
        expect(screen.getByRole("button", { name: "Delete event" })).toBeInTheDocument();

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
        const sidebar = document.querySelector(".sidebar");
        expect(sidebar).toHaveAttribute("aria-hidden", "true");
        expect(sidebar).toHaveAttribute("inert");
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
        await userEvent.type(peopleSearch, "Taylor Johnson");
        await userEvent.click(await screen.findByRole("option", { name: /Taylor Johnson/ }));
        await userEvent.click(screen.getByRole("button", { name: "Suggested times" }));
        expect(await screen.findByRole("dialog", { name: "Suggested times" })).toBeInTheDocument();
        await waitFor(() => expect(mocks.availabilitySuggestions).toHaveBeenCalledWith(expect.objectContaining({ participantIds: ["person-1"], durationMinutes: 30 })));
        await userEvent.click(await screen.findByRole("button", { name: /2 available/ }));
        expect(screen.getByTestId("event-title-input")).toHaveValue("Meeting with Taylor Johnson");
        expect(screen.getByLabelText("Selected guests")).toHaveTextContent("Taylor Johnson");
        await userEvent.click(screen.getByTestId("save-event-button"));
        await waitFor(() => expect(mocks.eventCreate).toHaveBeenCalledWith(expect.objectContaining({ participants: ["Taylor Johnson"], startAt: "2026-08-28T05:30:00.000Z", endAt: "2026-08-28T06:00:00.000Z" })));
    });

    test("opens another person's comparison event as read-only details", async () => {
        mocks.availabilitySuggestions.mockResolvedValue({
            owner: { name: "You", busy: [] },
            participants: [{ person: participant, busy: [{ _id: "participant-event", title: "Design critique", description: "Review the new flow.", location: "Studio", type: "event", startAt: "2026-08-28T09:00:00.000Z", endAt: "2026-08-28T10:00:00.000Z" }] }],
            suggestions: [],
        });
        render(<App />);
        await screen.findByRole("button", { name: /Design review/ });
        const peopleSearch = screen.getByRole("textbox", { name: "Search for people" });
        await userEvent.click(peopleSearch);
        await userEvent.type(peopleSearch, "Taylor Johnson");
        await userEvent.click(await screen.findByRole("option", { name: /Taylor Johnson/ }));
        await userEvent.click(await screen.findByRole("button", { name: /Design critique.*Taylor Johnson/ }));
        expect(screen.getByRole("dialog")).toHaveTextContent("Design critique");
        expect(screen.getByRole("dialog")).toHaveTextContent("Organized by Taylor Johnson");
        expect(screen.getByRole("dialog")).toHaveTextContent("Studio");
        expect(screen.getByRole("dialog")).toHaveTextContent("Review the new flow.");
        expect(screen.queryByRole("button", { name: "Edit event" })).not.toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Delete event" })).not.toBeInTheDocument();
        expect(screen.queryByTestId("event-title-input")).not.toBeInTheDocument();
    });

    test("responds to an invitation in place and preserves the preview", async () => {
        const invitation = { ...events[0], editable: false, organizer: "Taylor Johnson", responseStatus: "needsAction", responseSummary: { needsAction: 1, accepted: 0, declined: 0, tentative: 0 }, participantPeople: [{ ...activeProfile, responseStatus: "needsAction" }] };
        mocks.eventList.mockResolvedValue([invitation]);
        mocks.eventRespond.mockResolvedValue({ ...invitation, responseStatus: "accepted", respondedAt: new Date().toISOString(), responseSummary: { needsAction: 0, accepted: 1, declined: 0, tentative: 0 }, participantPeople: [{ ...activeProfile, responseStatus: "accepted" }] });
        render(<App />);
        await userEvent.click(await screen.findByRole("button", { name: /Design review/ }));
        expect(screen.getByText("Going?")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Yes, attending" }));
        await waitFor(() => expect(mocks.eventRespond).toHaveBeenCalledWith("event-1", "accepted"));
        expect(screen.getByRole("button", { name: "Yes, attending" })).toHaveAttribute("aria-pressed", "true");
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.queryByRole("button", { name: "Edit event" })).not.toBeInTheDocument();
    });

    test("keeps the invitation open and reports response failures", async () => {
        const invitation = { ...events[0], editable: false, organizer: "Taylor Johnson", responseStatus: "needsAction", responseSummary: { needsAction: 1, accepted: 0, declined: 0, tentative: 0 }, participantPeople: [{ ...activeProfile, responseStatus: "needsAction" }] };
        mocks.eventList.mockResolvedValue([invitation]);
        mocks.eventRespond.mockRejectedValue(new Error("Response could not be saved"));
        render(<App />);
        await userEvent.click(await screen.findByRole("button", { name: /Design review/ }));
        await userEvent.click(screen.getByRole("button", { name: "Maybe attending" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("Response could not be saved");
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Maybe attending" })).toHaveAttribute("aria-pressed", "false");
    });
});
