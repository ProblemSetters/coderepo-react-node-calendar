import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { calendarApi } from "../features/calendar/calendar.api.js";
import { eventApi } from "../features/events/event.api.js";
import { insightApi } from "../features/insights/insight.api.js";
import { availabilityApi } from "../features/people/availability.api.js";
import { peopleApi } from "../features/people/people.api.js";
import { profileApi } from "../features/profiles/profile.api.js";
import { hasSessionToken, request, setProfileToken, setSessionToken } from "../shared/api/client.js";

beforeEach(() => { globalThis.fetch = vi.fn(); setProfileToken(""); setSessionToken(""); });
afterEach(() => { vi.restoreAllMocks(); });

describe("API client", () => {
    test("unwraps successful JSON and handles empty deletion responses", async () => {
        fetch.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ data: [{ _id: "calendar-1" }] }) });
        await expect(calendarApi.list()).resolves.toEqual([{ _id: "calendar-1" }]);
        fetch.mockResolvedValueOnce({ ok: true, status: 204 });
        await expect(calendarApi.remove("calendar-1")).resolves.toBeNull();
    });

    test("surfaces stable backend errors and network failures", async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 409, json: async () => ({ error: { code: "CONFLICT", message: "Already exists" } }) });
        await expect(request("/calendars")).rejects.toThrow("Already exists");
        fetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
        await expect(request("/events")).rejects.toThrow("Failed to fetch");
    });

    test("reports non-JSON and malformed success responses clearly", async () => {
        fetch.mockResolvedValueOnce({ ok: false, status: 502, headers: { get: () => "text/html" } });
        await expect(request("/events")).rejects.toThrow("Calendar service returned 502.");
        fetch.mockResolvedValueOnce({ ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({ status: "ok" }) });
        await expect(request("/events")).rejects.toThrow("invalid response");
    });

    test("clears an expired authenticated session and notifies the application", async () => {
        setSessionToken("expired-workspace-token"); setProfileToken("expired-profile-token");
        const expired = vi.fn(); window.addEventListener("calendar-session-expired", expired, { once: true });
        fetch.mockResolvedValueOnce({ ok: false, status: 401, headers: { get: () => "application/json" }, json: async () => ({ error: { code: "INVALID_TOKEN", message: "Session expired" } }) });
        await expect(request("/calendars")).rejects.toThrow("Session expired");
        expect(hasSessionToken()).toBe(false);
        expect(expired).toHaveBeenCalledOnce();
    });

    test("encodes event ranges and advanced search parameters safely", async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) });
        await eventApi.list("2026-08-27T00:00:00+05:30", "2026-08-28T00:00:00+05:30", ["one", "two"]);
        expect(fetch.mock.calls[0][0]).toContain("from=2026-08-27T00%3A00%3A00%2B05%3A30");
        await eventApi.search({ what: "design & review", who: "", where: "Room 1", exclude: "", from: "", to: "" }, ["one"]);
        const searchUrl = fetch.mock.calls[1][0];
        expect(searchUrl).toContain("what=design+%26+review");
        expect(searchUrl).toContain("where=Room+1");
        expect(searchUrl).not.toContain("who=");
    });

    test("sends mutation payloads and insight calendar scope correctly", async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: {} }) });
        await eventApi.create({ title: "Planning" });
        expect(fetch.mock.calls[0][1]).toEqual(expect.objectContaining({ method: "POST", body: JSON.stringify({ title: "Planning" }) }));
        await calendarApi.update("calendar-1", { visible: false });
        expect(fetch.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "PATCH", body: JSON.stringify({ visible: false }) }));
        await insightApi.daily("from", "to", ["one", "two"]);
        expect(fetch.mock.calls[2][0]).toContain("calendarIds=one%2Ctwo");
        await eventApi.respond("event-1", "tentative");
        expect(fetch.mock.calls[3]).toEqual([expect.stringContaining("/events/event-1/response"), expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "tentative" }) })]);
        await eventApi.respond("event-1", "accepted", { scope: "following", occurrenceStartAt: "2026-08-27T09:00:00.000Z" });
        expect(fetch.mock.calls[4][1].body).toBe(JSON.stringify({ status: "accepted", scope: "following", occurrenceStartAt: "2026-08-27T09:00:00.000Z" }));
    });

    test("encodes people searches and posts availability criteria", async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) });
        await peopleApi.search("Sky & Sage");
        expect(fetch.mock.calls[0][0]).toContain("/people?q=Sky%20%26%20Sage&limit=20");
        const payload = { participantIds: ["person-1"], from: "2026-08-27", timeZone: "Asia/Kolkata", days: 5, durationMinutes: 30 };
        await availabilityApi.suggestions(payload);
        expect(fetch.mock.calls[1][1]).toEqual(expect.objectContaining({ method: "POST", body: JSON.stringify(payload) }));
        const conflictPayload = { participantIds: ["person-1"], startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z" };
        await availabilityApi.conflicts(conflictPayload);
        expect(fetch.mock.calls[2][0]).toContain("/availability/conflicts");
        expect(fetch.mock.calls[2][1]).toEqual(expect.objectContaining({ method: "POST", body: JSON.stringify(conflictPayload) }));
    });

    test("sends workspace and active-profile bearer tokens", async () => {
        fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: [] }) });
        setSessionToken("workspace-token");
        await profileApi.list();
        expect(fetch.mock.calls[0][1].headers).toEqual(expect.objectContaining({ Authorization: "Bearer workspace-token" }));
        setProfileToken("profile-token");
        await calendarApi.list();
        expect(fetch.mock.calls[1][1].headers).toEqual(expect.objectContaining({ Authorization: "Bearer profile-token" }));
    });
});
