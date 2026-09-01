import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ peopleSearch: vi.fn(), availabilitySuggestions: vi.fn() }));
vi.mock("../src/features/people/people.api.js", () => ({ peopleApi: { search: mocks.peopleSearch } }));
vi.mock("../src/features/people/availability.api.js", () => ({ availabilityApi: { suggestions: mocks.availabilitySuggestions, conflicts: vi.fn() } }));

import { MeetWith } from "../src/features/people/MeetWith.jsx";
import { PeoplePicker } from "../src/features/people/PeoplePicker.jsx";
import { AvailabilityComparison } from "../src/features/people/AvailabilityComparison.jsx";
import { SuggestedTimesDrawer } from "../src/features/people/SuggestedTimesDrawer.jsx";

const user02 = { _id: "person-1", name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#d93025" };
const user03 = { _id: "person-2", name: "Taylor Johnson", email: "taylor.johnson@calendar.com", avatarColor: "#1a73e8" };
const response = {
    owner: { name: "You", workingIntervals: [{ startAt: "2026-08-27T03:30:00.000Z", endAt: "2026-08-27T12:00:00.000Z" }], busy: [{ _id: "event-owner", calendarId: "calendar-1", title: "Review", startAt: "2026-08-27T04:30:00.000Z", endAt: "2026-08-27T05:30:00.000Z" }] },
    participants: [{ person: user02, workingIntervals: [{ startAt: "2026-08-27T04:30:00.000Z", endAt: "2026-08-27T12:30:00.000Z" }], busy: [
        { _id: "event-user02", title: "Design critique", location: "Studio", description: "Review the new flow.", startAt: "2026-08-27T06:30:00.000Z", endAt: "2026-08-27T07:30:00.000Z" },
        { _id: "event-user02-short", title: "Quick sync", startAt: "2026-08-27T08:00:00.000Z", endAt: "2026-08-27T08:30:00.000Z" },
    ] }],
    suggestions: [{ startAt: "2026-08-27T06:30:00.000Z", endAt: "2026-08-27T07:00:00.000Z", attendeeCount: 2 }],
};

beforeEach(() => { vi.clearAllMocks(); mocks.peopleSearch.mockResolvedValue([user03, user02]); mocks.availabilitySuggestions.mockResolvedValue(response); });

describe("Meet with people", () => {
    test("searches, selects, removes, and opens suggestions with the selected people", async () => {
        const open = vi.fn();
        const change = vi.fn();
        render(<MeetWith onOpenSuggestions={open} onSelectionChange={change} />);
        await userEvent.click(screen.getByRole("textbox", { name: "Search for people" }));
        expect(await screen.findByRole("option", { name: /Taylor Johnson/ })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("option", { name: /Taylor Johnson/ }));
        expect(change).toHaveBeenLastCalledWith([user03]);
        expect(screen.getByText("Taylor Johnson")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Remove Taylor Johnson" }));
        expect(screen.queryByRole("button", { name: "Suggested times" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("textbox", { name: "Search for people" }));
        await userEvent.click(await screen.findByRole("option", { name: /Jordan Smith/ }));
        await userEvent.click(screen.getByRole("button", { name: "Suggested times" }));
        expect(open).toHaveBeenCalledWith([user02]);
    });

    test("shows directory failures and no-result states", async () => {
        mocks.peopleSearch.mockRejectedValueOnce(new Error("People directory unavailable")).mockResolvedValueOnce([]);
        render(<MeetWith onOpenSuggestions={vi.fn()} />);
        await userEvent.click(screen.getByRole("textbox", { name: "Search for people" }));
        expect(await screen.findByRole("alert")).toHaveTextContent("People directory unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        expect(await screen.findByText("No people available")).toBeInTheDocument();
    });

    test("supports listbox arrow navigation and Enter selection", async () => {
        render(<MeetWith onOpenSuggestions={vi.fn()} />);
        const input = screen.getByRole("textbox", { name: "Search for people" });
        await userEvent.click(input);
        await screen.findByRole("option", { name: /Taylor Johnson/ });
        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(screen.getByRole("button", { name: "Remove Jordan Smith" })).toBeInTheDocument();
    });

    test("keeps a long people list internally scrollable and follows keyboard navigation", async () => {
        const people = Array.from({ length: 12 }, (_, index) => ({ _id: `person-${index}`, name: `Guest ${String(index + 1).padStart(2, "0")}`, email: `guest${index + 1}@calendar.com`, avatarColor: "#1a73e8" }));
        const scrollIntoView = vi.spyOn(Element.prototype, "scrollIntoView").mockImplementation(() => {});
        const getBoundingClientRect = vi.spyOn(Element.prototype, "getBoundingClientRect").mockImplementation(function getRect() {
            if (this.classList?.contains("people-search")) return { top: 400, right: 500, bottom: 442, left: 100, width: 400, height: 42, x: 100, y: 400, toJSON: () => ({}) };
            if (this.classList?.contains("modal-actions")) return { top: 500, right: 700, bottom: 560, left: 100, width: 600, height: 60, x: 100, y: 500, toJSON: () => ({}) };
            return { top: 0, right: 0, bottom: 0, left: 0, width: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) };
        });
        mocks.peopleSearch.mockResolvedValue(people);
        render(<dialog open><PeoplePicker onSelectionChange={vi.fn()} /><div className="modal-actions" /></dialog>);
        const input = screen.getByRole("textbox", { name: "Search for people" });
        await userEvent.click(input);
        expect(await screen.findAllByRole("option")).toHaveLength(12);
        expect(screen.getByRole("listbox")).toHaveStyle({ maxHeight: "336px" });
        expect(screen.getByRole("listbox")).toHaveStyle({ bottom: "372px", top: "auto" });
        await userEvent.keyboard("{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}");
        expect(input.getAttribute("aria-activedescendant")).toMatch(/person-option-person-8$/);
        expect(scrollIntoView).toHaveBeenCalledWith({ block: "nearest" });
        scrollIntoView.mockRestore();
        getBoundingClientRect.mockRestore();
    });
});

describe("calendar comparison", () => {
    test("loads and renders You beside every selected person", async () => {
        render(<AvailabilityComparison cursor={new Date("2026-08-27T00:00:00")} people={[user02]} onCreate={vi.fn()} />);
        expect(await screen.findByLabelText("You schedule")).toBeInTheDocument();
        expect(screen.getByLabelText("Jordan Smith schedule")).toBeInTheDocument();
        expect(await screen.findByTestId("working-window-owner")).toBeInTheDocument();
        expect(await screen.findByTestId(`working-window-${user02._id}`)).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /Quick sync.*Jordan Smith/ })).toHaveAttribute("data-density", "micro");
        expect(screen.queryByText("Your calendar")).not.toBeInTheDocument();
        expect(screen.queryByText("Availability")).not.toBeInTheDocument();
        expect(mocks.availabilitySuggestions).toHaveBeenCalledWith(expect.objectContaining({ participantIds: [user02._id], days: 1 }));
    });

    test("retries failed comparisons and creates on 15-minute boundaries", async () => {
        const create = vi.fn();
        mocks.availabilitySuggestions.mockRejectedValueOnce(new Error("Comparison unavailable")).mockResolvedValueOnce(response);
        render(<AvailabilityComparison cursor={new Date("2026-08-27T00:00:00")} people={[user02]} onCreate={create} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Comparison unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        await screen.findByTestId(`working-window-${user02._id}`);
        const schedule = screen.getByLabelText("You schedule");
        schedule.getBoundingClientRect = () => ({ top: 0, height: 1536, left: 0, right: 190, bottom: 1536, width: 190, x: 0, y: 0, toJSON: () => ({}) });
        fireEvent.click(schedule, { clientY: 649 });
        expect(create).toHaveBeenCalledWith(expect.any(Date), [user02]);
        expect(create.mock.calls[0][0].getMinutes() % 15).toBe(0);
    });

    test("allows striped owner time but blocks striped time on another person's calendar", async () => {
        const create = vi.fn();
        render(<AvailabilityComparison cursor={new Date("2026-08-27T00:00:00")} people={[user02]} onCreate={create} />);
        await screen.findByTestId("working-window-owner");
        const ownerSchedule = screen.getByLabelText("You schedule");
        ownerSchedule.getBoundingClientRect = () => ({ top: 0, height: 1536, left: 0, right: 190, bottom: 1536, width: 190, x: 0, y: 0, toJSON: () => ({}) });
        fireEvent.click(ownerSchedule, { clientY: 400 });
        expect(create).toHaveBeenCalledTimes(1);
        const otherSchedule = screen.getByLabelText("Jordan Smith schedule");
        otherSchedule.getBoundingClientRect = () => ({ top: 0, height: 1536, left: 190, right: 380, bottom: 1536, width: 190, x: 190, y: 0, toJSON: () => ({}) });
        fireEvent.click(otherSchedule, { clientY: 400 });
        expect(create).toHaveBeenCalledTimes(1);
        expect(screen.getByRole("status")).toHaveTextContent("You can’t schedule events for this calendar.");
    });

    test("opens busy events instead of creating a meeting through them", async () => {
        const create = vi.fn();
        const select = vi.fn();
        render(<AvailabilityComparison cursor={new Date("2026-08-27T00:00:00")} people={[user02]} onCreate={create} onEventSelect={select} />);
        const otherEvent = await screen.findByRole("button", { name: /Design critique.*Jordan Smith/ });
        await userEvent.click(otherEvent);
        expect(create).not.toHaveBeenCalled();
        expect(select).toHaveBeenCalledWith(expect.objectContaining({ _id: "event-user02", title: "Design critique", editable: false, readOnlyOwner: "Jordan Smith", calendarName: "Jordan Smith’s calendar" }));

        await userEvent.click(screen.getByRole("button", { name: /Review.*You/ }));
        expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ _id: "event-owner", editable: true, calendarName: "Your calendar" }));
    });
});

describe("Suggested times drawer", () => {
    test("loads availability, changes duration, and returns the chosen slot", async () => {
        const choose = vi.fn();
        render(<SuggestedTimesDrawer cursor={new Date("2026-08-27T00:00:00")} people={[user02]} onChoose={choose} onClose={vi.fn()} />);
        expect(await screen.findByRole("button", { name: /2 available/ })).toBeInTheDocument();
        expect(screen.getByLabelText("You availability")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("combobox", { name: "Duration" }));
        await userEvent.click(screen.getByRole("option", { name: "1 hour" }));
        await waitFor(() => expect(mocks.availabilitySuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ durationMinutes: 60 })));
        await userEvent.click(screen.getByRole("button", { name: /2 available/ }));
        expect(choose).toHaveBeenCalledWith(response.suggestions[0], [user02]);
    });

    test("supports API error retry, empty availability, and Escape close", async () => {
        const close = vi.fn();
        mocks.availabilitySuggestions.mockRejectedValueOnce(new Error("Availability unavailable")).mockResolvedValueOnce({ ...response, suggestions: [] });
        render(<SuggestedTimesDrawer cursor={new Date("2026-08-27T00:00:00")} people={[user02]} onChoose={vi.fn()} onClose={close} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Availability unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("No open times found")).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");
        expect(close).toHaveBeenCalled();
    });
});
