import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({ peopleSearch: vi.fn(), availabilitySuggestions: vi.fn() }));
vi.mock("../features/people/people.api.js", () => ({ peopleApi: { search: mocks.peopleSearch } }));
vi.mock("../features/people/availability.api.js", () => ({ availabilityApi: { suggestions: mocks.availabilitySuggestions, conflicts: vi.fn() } }));

import { MeetWith } from "../features/people/MeetWith.jsx";
import { AvailabilityComparison } from "../features/people/AvailabilityComparison.jsx";
import { SuggestedTimesDrawer } from "../features/people/SuggestedTimesDrawer.jsx";

const diya = { _id: "person-1", name: "Diya Shah", email: "diya@example.com", avatarColor: "#d93025" };
const aarav = { _id: "person-2", name: "Aarav Mehta", email: "aarav@example.com", avatarColor: "#1a73e8" };
const response = {
    owner: { name: "You", busy: [{ _id: "event-owner", calendarId: "calendar-1", title: "Review", startAt: "2026-08-27T04:30:00.000Z", endAt: "2026-08-27T05:30:00.000Z" }] },
    participants: [{ person: diya, busy: [{ _id: "event-diya", title: "Design critique", location: "Studio", description: "Review the new flow.", startAt: "2026-08-27T06:30:00.000Z", endAt: "2026-08-27T07:30:00.000Z" }] }],
    suggestions: [{ startAt: "2026-08-27T06:30:00.000Z", endAt: "2026-08-27T07:00:00.000Z", attendeeCount: 2 }],
};

beforeEach(() => { vi.clearAllMocks(); mocks.peopleSearch.mockResolvedValue([aarav, diya]); mocks.availabilitySuggestions.mockResolvedValue(response); });

describe("Meet with people", () => {
    test("searches, selects, removes, and opens suggestions with the selected people", async () => {
        const open = vi.fn();
        const change = vi.fn();
        render(<MeetWith onOpenSuggestions={open} onSelectionChange={change} />);
        await userEvent.click(screen.getByRole("textbox", { name: "Search for people" }));
        expect(await screen.findByRole("option", { name: /Aarav Mehta/ })).toBeInTheDocument();
        await userEvent.click(screen.getByRole("option", { name: /Aarav Mehta/ }));
        expect(change).toHaveBeenLastCalledWith([aarav]);
        expect(screen.getByText("Aarav Mehta")).toBeInTheDocument();
        await userEvent.click(screen.getByRole("button", { name: "Remove Aarav Mehta" }));
        expect(screen.queryByRole("button", { name: "Suggested times" })).not.toBeInTheDocument();
        await userEvent.click(screen.getByRole("textbox", { name: "Search for people" }));
        await userEvent.click(await screen.findByRole("option", { name: /Diya Shah/ }));
        await userEvent.click(screen.getByRole("button", { name: "Suggested times" }));
        expect(open).toHaveBeenCalledWith([diya]);
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
        await screen.findByRole("option", { name: /Aarav Mehta/ });
        await userEvent.keyboard("{ArrowDown}{Enter}");
        expect(screen.getByRole("button", { name: "Remove Diya Shah" })).toBeInTheDocument();
    });
});

describe("calendar comparison", () => {
    test("loads and renders You beside every selected person", async () => {
        render(<AvailabilityComparison cursor={new Date("2026-08-27T00:00:00")} people={[diya]} onCreate={vi.fn()} />);
        expect(await screen.findByLabelText("You schedule")).toBeInTheDocument();
        expect(screen.getByLabelText("Diya Shah schedule")).toBeInTheDocument();
        expect(screen.queryByText("Your calendar")).not.toBeInTheDocument();
        expect(screen.queryByText("Availability")).not.toBeInTheDocument();
        expect(mocks.availabilitySuggestions).toHaveBeenCalledWith(expect.objectContaining({ participantIds: [diya._id], days: 1 }));
    });

    test("retries failed comparisons and creates on 15-minute boundaries", async () => {
        const create = vi.fn();
        mocks.availabilitySuggestions.mockRejectedValueOnce(new Error("Comparison unavailable")).mockResolvedValueOnce(response);
        render(<AvailabilityComparison cursor={new Date("2026-08-27T00:00:00")} people={[diya]} onCreate={create} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Comparison unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Retry" }));
        await screen.findByLabelText("Diya Shah schedule");
        const schedule = screen.getByLabelText("You schedule");
        schedule.getBoundingClientRect = () => ({ top: 0, height: 1536, left: 0, right: 190, bottom: 1536, width: 190, x: 0, y: 0, toJSON: () => ({}) });
        await userEvent.click(schedule, { clientY: 649 });
        expect(create).toHaveBeenCalledWith(expect.any(Date), [diya]);
        expect(create.mock.calls[0][0].getMinutes() % 15).toBe(0);
    });

    test("opens busy events instead of creating a meeting through them", async () => {
        const create = vi.fn();
        const select = vi.fn();
        render(<AvailabilityComparison cursor={new Date("2026-08-27T00:00:00")} people={[diya]} onCreate={create} onEventSelect={select} />);
        const otherEvent = await screen.findByRole("button", { name: /Design critique.*Diya Shah/ });
        await userEvent.click(otherEvent);
        expect(create).not.toHaveBeenCalled();
        expect(select).toHaveBeenCalledWith(expect.objectContaining({ _id: "event-diya", title: "Design critique", editable: false, readOnlyOwner: "Diya Shah", calendarName: "Diya Shah’s calendar" }));

        await userEvent.click(screen.getByRole("button", { name: /Review.*You/ }));
        expect(select).toHaveBeenLastCalledWith(expect.objectContaining({ _id: "event-owner", editable: true, calendarName: "Your calendar" }));
    });
});

describe("Suggested times drawer", () => {
    test("loads availability, changes duration, and returns the chosen slot", async () => {
        const choose = vi.fn();
        render(<SuggestedTimesDrawer cursor={new Date("2026-08-27T00:00:00")} people={[diya]} onChoose={choose} onClose={vi.fn()} />);
        expect(await screen.findByRole("button", { name: /2 available/ })).toBeInTheDocument();
        expect(screen.getByLabelText("You availability")).toBeInTheDocument();
        await userEvent.selectOptions(screen.getByRole("combobox", { name: "Duration" }), "60");
        await waitFor(() => expect(mocks.availabilitySuggestions).toHaveBeenLastCalledWith(expect.objectContaining({ durationMinutes: 60 })));
        await userEvent.click(screen.getByRole("button", { name: /2 available/ }));
        expect(choose).toHaveBeenCalledWith(response.suggestions[0], [diya]);
    });

    test("supports API error retry, empty availability, and Escape close", async () => {
        const close = vi.fn();
        mocks.availabilitySuggestions.mockRejectedValueOnce(new Error("Availability unavailable")).mockResolvedValueOnce({ ...response, suggestions: [] });
        render(<SuggestedTimesDrawer cursor={new Date("2026-08-27T00:00:00")} people={[diya]} onChoose={vi.fn()} onClose={close} />);
        expect(await screen.findByRole("alert")).toHaveTextContent("Availability unavailable");
        await userEvent.click(screen.getByRole("button", { name: "Try again" }));
        expect(await screen.findByText("No open times found")).toBeInTheDocument();
        await userEvent.keyboard("{Escape}");
        expect(close).toHaveBeenCalled();
    });
});
