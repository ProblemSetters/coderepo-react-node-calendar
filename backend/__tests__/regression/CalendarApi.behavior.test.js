import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { createApp } from "../../src/app.js";
import { WorkspaceAccount } from "../../src/features/auth/workspace-account.model.js";
import { Calendar } from "../../src/features/calendars/calendar.model.js";
import { Event } from "../../src/features/events/event.model.js";
import { Person } from "../../src/features/people/person.model.js";
import { config } from "../../src/shared/config/index.js";

let database;
let primary;
let work;
const app = createApp();
const eventPayload = () => ({
    calendarId: String(primary._id),
    title: "Design review",
    description: "Review the release plan.",
    location: "Room Cedar",
    startAt: "2026-08-27T09:00:00.000Z",
    endAt: "2026-08-27T10:00:00.000Z",
    allDay: false,
});

beforeAll(async () => {
    database = await MongoMemoryServer.create();
    await mongoose.connect(database.getUri("calendar_db_test"));
}, 120000);

beforeEach(async () => {
    await Promise.all([Calendar.deleteMany({}), Event.deleteMany({}), Person.deleteMany({}), WorkspaceAccount.deleteMany({})]);
    [primary, work] = await Calendar.create([
        { name: "My calendar", color: "#1a73e8", visible: true, isPrimary: true },
        { name: "Work", color: "#0f9d58", visible: true },
    ]);
});

const personPayload = (overrides = {}) => ({
    name: "Taylor Johnson",
    email: "taylor.johnson@calendar.com",
    avatarColor: "#d93025",
    workingHours: { startMinute: 540, endMinute: 1020 },
    busyBlocks: [],
    ...overrides,
});

afterAll(async () => {
    await mongoose.disconnect();
    if (database) await database.stop();
});

describe("health", () => {
    test("reports API and database availability", async () => {
        const response = await request(app).get("/api/v1/health");
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual({ status: "ok", database: "connected" });
    });

    test("allows the documented Vite development fallback origin", async () => {
        const response = await request(app).get("/api/v1/health").set("Origin", "http://localhost:3000");
        expect(response.status).toBe(200);
        expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    });
});

describe("workspace authentication", () => {
    test("authenticates once, scopes profile switching, and rejects invalid sessions", async () => {
        const [river, outsider] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", isProfile: true }),
            personPayload({ name: "Outside", email: "outside@calendar.com", isProfile: true }),
        ]);
        const account = await WorkspaceAccount.create({ name: "Shared workspace", email: "workspace@calendar.com", passwordHash: await bcrypt.hash("password123", 4), allowedProfileIds: [river._id] });

        expect((await request(app).get("/api/v1/auth/session")).body.error.code).toBe("AUTH_REQUIRED");
        expect((await request(app).post("/api/v1/auth/login").send({ email: "workspace@calendar.com", password: "wrong" })).body.error.code).toBe("INVALID_CREDENTIALS");
        const login = await request(app).post("/api/v1/auth/login").send({ email: "WORKSPACE@CALENDAR.COM", password: "password123" });
        expect(login.status).toBe(200);
        expect(login.body.data.account).toEqual(expect.objectContaining({ name: "Shared workspace", email: "workspace@calendar.com" }));
        expect(JSON.stringify(login.body)).not.toContain("passwordHash");
        const workspaceToken = login.body.data.token;
        const auth = { Authorization: `Bearer ${workspaceToken}` };
        expect((await request(app).get("/api/v1/auth/session").set(auth)).body.data.account.email).toBe("workspace@calendar.com");
        expect((await request(app).get("/api/v1/profiles").set(auth)).body.data.map((profile) => profile.name)).toEqual(["Alex Morgan"]);
        expect((await request(app).get("/api/v1/calendars").set(auth)).body.error.code).toBe("PROFILE_REQUIRED");
        expect((await request(app).post("/api/v1/auth/switch-profile").set(auth).send({ profileId: String(outsider._id) })).body.error.code).toBe("PROFILE_FORBIDDEN");
        expect((await request(app).post("/api/v1/auth/switch-profile").set(auth).send({ profileId: "bad-id" })).status).toBe(400);

        const switched = await request(app).post("/api/v1/auth/switch-profile").set(auth).send({ profileId: String(river._id) });
        expect(switched.body.data.profile.name).toBe("Alex Morgan");
        expect((await request(app).get("/api/v1/calendars").set("Authorization", `Bearer ${switched.body.data.token}`)).status).toBe(200);
        expect((await request(app).get("/api/v1/auth/session").set("Authorization", `Bearer ${workspaceToken}tampered`)).body.error.code).toBe("INVALID_TOKEN");
        const expired = jwt.sign({ sub: String(account._id), type: "workspace" }, config.jwtSecret, { expiresIn: -1, issuer: "calendar-api", audience: "calendar-assessment" });
        expect((await request(app).get("/api/v1/auth/session").set("Authorization", `Bearer ${expired}`)).body.error.code).toBe("INVALID_TOKEN");
        await WorkspaceAccount.deleteOne({ _id: account._id });
        expect((await request(app).get("/api/v1/auth/session").set(auth)).body.error.code).toBe("ACCOUNT_UNAVAILABLE");
    });
});

describe("demo profiles", () => {
    test("lists selectable profiles and isolates calendars while sharing invitations", async () => {
        const [user01, user03] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5", isProfile: true, sortOrder: 1 }),
            personPayload({ isProfile: true, sortOrder: 2 }),
        ]);
        const [user01Calendar, user03Calendar] = await Calendar.create([
            { ownerId: user01._id, name: "My calendar", color: "#039be5", visible: true, isPrimary: true },
            { ownerId: user03._id, name: "My calendar", color: "#d93025", visible: true, isPrimary: true },
        ]);
        const meeting = await Event.create({ ...eventPayload(), calendarId: user01Calendar._id, participants: [user03.name], participantIds: [user03._id] });

        const profiles = await request(app).get("/api/v1/profiles");
        expect(profiles.body.data.map((profile) => profile.name)).toEqual(["Alex Morgan", "Taylor Johnson"]);
        expect(profiles.body.data[0].busyBlocks).toBeUndefined();

        const user03Calendars = await request(app).get("/api/v1/calendars").set("X-Calendar-Profile", String(user03._id));
        expect(user03Calendars.body.data.map((calendar) => String(calendar._id))).toEqual([String(user03Calendar._id)]);
        const user03Events = await request(app).get(`/api/v1/events?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${user03Calendar._id}`).set("X-Calendar-Profile", String(user03._id));
        expect(user03Events.body.data).toEqual([expect.objectContaining({ _id: String(meeting._id), editable: false })]);
        const forbiddenUpdate = await request(app).patch(`/api/v1/events/${meeting._id}`).set("X-Calendar-Profile", String(user03._id)).send({ title: "Changed by guest" });
        expect(forbiddenUpdate.status).toBe(404);

        const ownerEvents = await request(app).get(`/api/v1/events?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${user01Calendar._id}`).set("X-Calendar-Profile", String(user01._id));
        expect(ownerEvents.status).toBe(200);
        expect(ownerEvents.body.data).toEqual([expect.objectContaining({ _id: String(meeting._id), editable: true })]);
        expect((await request(app).get("/api/v1/calendars").set("X-Calendar-Profile", "not-a-profile")).body.error.code).toBe("INVALID_PROFILE");
    });
});

describe("calendars", () => {
    test("lists calendars with the primary calendar first", async () => {
        const response = await request(app).get("/api/v1/calendars");
        expect(response.status).toBe(200);
        expect(response.body.data[0].isPrimary).toBe(true);
    });

    test("creates and updates a secondary calendar", async () => {
        const created = await request(app).post("/api/v1/calendars").send({ name: "Personal", description: "Private appointments", color: "#a142f4", timeZone: "Asia/Kolkata" });
        expect(created.status).toBe(201);
        expect(created.body.data).toEqual(expect.objectContaining({ description: "Private appointments", timeZone: "Asia/Kolkata", color: "#a142f4", defaultColor: "#a142f4", visible: true, isPrimary: false }));
        const updated = await request(app).patch(`/api/v1/calendars/${created.body.data._id}`).send({ visible: false });
        expect(updated.status).toBe(200);
        expect(updated.body.data.visible).toBe(false);
    });

    test("rejects a duplicate calendar name", async () => {
        const response = await request(app).post("/api/v1/calendars").send({ name: "work", color: "#a142f4" });
        expect(response.status).toBe(409);
        expect(response.body.error.code).toBe("CALENDAR_NAME_CONFLICT");
    });

    test("rejects invalid calendar metadata", async () => {
        const invalidZone = await request(app).post("/api/v1/calendars").send({ name: "Travel", color: "#a142f4", timeZone: "Mars/Olympus" });
        expect(invalidZone.status).toBe(400);
        expect(invalidZone.body.error.code).toBe("VALIDATION_ERROR");
        const longDescription = await request(app).post("/api/v1/calendars").send({ name: "Travel", color: "#a142f4", description: "x".repeat(1001) });
        expect(longDescription.status).toBe(400);
    });

    test("displays one calendar exclusively in a single operation", async () => {
        const response = await request(app).post(`/api/v1/calendars/${work._id}/display-only`);
        expect(response.status).toBe(200);
        const visibility = Object.fromEntries(response.body.data.map((calendar) => [calendar.name, calendar.visible]));
        expect(visibility).toEqual({ "My calendar": false, Work: true });
        const persisted = await Calendar.find().lean();
        expect(persisted.find((calendar) => calendar.name === "My calendar").visible).toBe(false);
        expect(persisted.find((calendar) => calendar.name === "Work").visible).toBe(true);
    });

    test("protects primary and non-empty calendars from deletion", async () => {
        const primaryResponse = await request(app).delete(`/api/v1/calendars/${primary._id}`);
        expect(primaryResponse.body.error.code).toBe("PRIMARY_CALENDAR");
        await Event.create({ ...eventPayload(), calendarId: work._id });
        const response = await request(app).delete(`/api/v1/calendars/${work._id}`);
        expect(response.status).toBe(409);
        expect(response.body.error.details.eventCount).toBe(1);
    });

    test("deletes an empty secondary calendar", async () => {
        const response = await request(app).delete(`/api/v1/calendars/${work._id}`);
        expect(response.status).toBe(204);
        expect(await Calendar.exists({ _id: work._id })).toBeNull();
    });

    test("handles missing and malformed calendar identifiers consistently", async () => {
        const missingId = new mongoose.Types.ObjectId();
        for (const [method, path] of [
            ["patch", `/api/v1/calendars/${missingId}`],
            ["post", `/api/v1/calendars/${missingId}/display-only`],
            ["delete", `/api/v1/calendars/${missingId}`],
            ["patch", "/api/v1/calendars/not-an-id"],
        ]) {
            const response = await request(app)[method](path).send(method === "patch" ? { color: "#4285f4" } : undefined);
            expect(response.status).toBe(404);
            expect(response.body.error.code).toBe("CALENDAR_NOT_FOUND");
        }
    });

    test("rejects empty updates, duplicate renames, and invalid colors", async () => {
        const empty = await request(app).patch(`/api/v1/calendars/${work._id}`).send({});
        expect(empty.status).toBe(400);
        const duplicate = await request(app).patch(`/api/v1/calendars/${work._id}`).send({ name: "MY CALENDAR" });
        expect(duplicate.status).toBe(409);
        expect(duplicate.body.error.code).toBe("CALENDAR_NAME_CONFLICT");
        const color = await request(app).patch(`/api/v1/calendars/${work._id}`).send({ color: "blue" });
        expect(color.status).toBe(400);
    });

    test("trims calendar metadata and applies safe defaults", async () => {
        const response = await request(app).post("/api/v1/calendars").send({ name: "  Personal  ", color: "#4285f4" });
        expect(response.status).toBe(201);
        expect(response.body.data).toEqual(expect.objectContaining({ name: "Personal", description: "", timeZone: "UTC", visible: true, isPrimary: false }));
    });
});

describe("events", () => {
    test("creates, retrieves, updates, lists, searches, and deletes an event", async () => {
        const created = await request(app).post("/api/v1/events").send(eventPayload());
        expect(created.status).toBe(201);
        const id = created.body.data._id;
        expect((await request(app).get(`/api/v1/events/${id}`)).body.data.location).toBe("Room Cedar");
        const updated = await request(app).patch(`/api/v1/events/${id}`).send({ title: "Release review" });
        expect(updated.body.data.title).toBe("Release review");
        const listed = await request(app).get(`/api/v1/events?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(listed.body.data).toHaveLength(1);
        const searched = await request(app).get(`/api/v1/events/search?q=Cedar&calendarIds=${primary._id}`);
        expect(searched.body.data).toHaveLength(1);
        expect((await request(app).delete(`/api/v1/events/${id}`)).status).toBe(204);
    });

    test("rejects invalid chronology and unknown calendars", async () => {
        const chronology = await request(app).post("/api/v1/events").send({ ...eventPayload(), endAt: "2026-08-27T08:00:00.000Z" });
        expect(chronology.body.error.code).toBe("INVALID_EVENT_RANGE");
        const calendar = await request(app).post("/api/v1/events").send({ ...eventPayload(), calendarId: new mongoose.Types.ObjectId().toString() });
        expect(calendar.status).toBe(422);
        expect(calendar.body.error.code).toBe("INVALID_CALENDAR");
    });

    test("filters events by visible calendar identifiers", async () => {
        await Event.create([eventPayload(), { ...eventPayload(), calendarId: work._id, title: "Work planning" }]);
        const response = await request(app).get(`/api/v1/events?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${work._id}`);
        expect(response.body.data.map((event) => event.title)).toEqual(["Work planning"]);
    });

    test("persists every supported calendar item type", async () => {
        const types = ["event", "task", "outOfOffice", "focusTime", "workingLocation", "appointmentSchedule"];
        for (const type of types) {
            const response = await request(app).post("/api/v1/events").send({ ...eventPayload(), title: type, type });
            expect(response.status).toBe(201);
            expect(response.body.data.type).toBe(type);
        }
        const invalid = await request(app).post("/api/v1/events").send({ ...eventPayload(), type: "unsupported" });
        expect(invalid.status).toBe(400);
        expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("combines advanced search filters safely", async () => {
        await Event.create([
            { ...eventPayload(), organizer: "Alex Morgan", participants: ["Jordan Smith"] },
            { ...eventPayload(), title: "Canceled review", description: "canceled", location: "Room Cedar", participants: ["Jordan Smith"] },
            { ...eventPayload(), title: "Remote review", location: "Online", participants: ["Taylor Johnson"] },
        ]);
        const response = await request(app).get(`/api/v1/events/search?what=release&who=Jordan Smith&where=Cedar&exclude=canceled&from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(response.status).toBe(200);
        expect(response.body.data.map((event) => event.title)).toEqual(["Design review"]);
    });

    test("returns stable errors for invalid identifiers and payloads", async () => {
        const missing = await request(app).get("/api/v1/events/not-an-object-id");
        expect(missing.status).toBe(404);
        expect(missing.body.error.code).toBe("EVENT_NOT_FOUND");
        const invalid = await request(app).post("/api/v1/events").send({ title: "Incomplete" });
        expect(invalid.status).toBe(400);
        expect(invalid.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("returns not-found errors for valid missing event identifiers", async () => {
        const id = new mongoose.Types.ObjectId();
        expect((await request(app).get(`/api/v1/events/${id}`)).body.error.code).toBe("EVENT_NOT_FOUND");
        expect((await request(app).patch(`/api/v1/events/${id}`).send({ title: "Missing" })).body.error.code).toBe("EVENT_NOT_FOUND");
        expect((await request(app).delete(`/api/v1/events/${id}`)).body.error.code).toBe("EVENT_NOT_FOUND");
    });

    test("validates partial updates against the complete persisted event", async () => {
        const event = await Event.create(eventPayload());
        const range = await request(app).patch(`/api/v1/events/${event._id}`).send({ endAt: "2026-08-27T08:59:00.000Z" });
        expect(range.status).toBe(400);
        expect(range.body.error.code).toBe("INVALID_EVENT_RANGE");
        const calendar = await request(app).patch(`/api/v1/events/${event._id}`).send({ calendarId: new mongoose.Types.ObjectId() });
        expect(calendar.status).toBe(422);
        const empty = await request(app).patch(`/api/v1/events/${event._id}`).send({});
        expect(empty.status).toBe(400);
        expect((await Event.findById(event._id).lean()).endAt.toISOString()).toBe("2026-08-27T10:00:00.000Z");
    });

    test("uses half-open overlap boundaries when listing a range", async () => {
        await Event.create([
            { ...eventPayload(), title: "Ends at boundary", startAt: "2026-08-26T23:00:00.000Z", endAt: "2026-08-27T00:00:00.000Z" },
            { ...eventPayload(), title: "Crosses start", startAt: "2026-08-26T23:30:00.000Z", endAt: "2026-08-27T00:30:00.000Z" },
            { ...eventPayload(), title: "Starts at end", startAt: "2026-08-28T00:00:00.000Z", endAt: "2026-08-28T01:00:00.000Z" },
        ]);
        const response = await request(app).get(`/api/v1/events?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(response.body.data.map((event) => event.title)).toEqual(["Crosses start"]);
    });

    test("escapes search expressions and applies inclusive date bounds", async () => {
        await Event.create([
            { ...eventPayload(), title: "Literal [review]", organizer: "A. Person", participants: ["Sam+Lee"] },
            { ...eventPayload(), title: "Next day", startAt: "2026-08-28T09:00:00.000Z", endAt: "2026-08-28T10:00:00.000Z" },
        ]);
        const literal = await request(app).get(`/api/v1/events/search?what=${encodeURIComponent("[review]")}&calendarIds=${primary._id}`);
        expect(literal.body.data.map((event) => event.title)).toEqual(["Literal [review]"]);
        const participant = await request(app).get(`/api/v1/events/search?who=${encodeURIComponent("Sam+Lee")}&calendarIds=${primary._id}`);
        expect(participant.body.data).toHaveLength(1);
        const date = await request(app).get(`/api/v1/events/search?from=2026-08-28T00:00:00.000Z&to=2026-08-29T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(date.body.data.map((event) => event.title)).toEqual(["Next day"]);
        const invalid = await request(app).get(`/api/v1/events/search?from=2026-08-29&to=2026-08-28&calendarIds=${primary._id}`);
        expect(invalid.status).toBe(400);
    });

    test("lets invited profiles answer Yes, Maybe, or No while organizers see an accurate summary", async () => {
        const [owner, user02, user03] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5", isProfile: true }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#7b1fa2", isProfile: true }),
            personPayload({ isProfile: true }),
        ]);
        const ownerCalendar = await Calendar.create({ ownerId: owner._id, name: "Owner calendar", color: "#039be5", visible: true, isPrimary: true });
        const created = await request(app).post("/api/v1/events").set("X-Calendar-Profile", String(owner._id)).send({
            ...eventPayload(),
            calendarId: String(ownerCalendar._id),
            participantIds: [String(user02._id), String(user03._id)],
            participants: [user02.name, user03.name],
        });
        expect(created.status).toBe(201);
        expect(created.body.data.responseSummary).toEqual({ needsAction: 2, accepted: 0, declined: 0, tentative: 0 });
        expect(created.body.data.participantPeople.map((person) => person.responseStatus)).toEqual(["needsAction", "needsAction"]);

        const accepted = await request(app).patch(`/api/v1/events/${created.body.data._id}/response`).set("X-Calendar-Profile", String(user02._id)).send({ status: "accepted" });
        expect(accepted.status).toBe(200);
        expect(accepted.body.data).toEqual(expect.objectContaining({ editable: false, responseStatus: "accepted", respondedAt: expect.any(String) }));
        expect(accepted.body.data.responseSummary).toEqual({ needsAction: 1, accepted: 1, declined: 0, tentative: 0 });

        const tentative = await request(app).patch(`/api/v1/events/${created.body.data._id}/response`).set("X-Calendar-Profile", String(user02._id)).send({ status: "tentative" });
        expect(tentative.body.data.responseStatus).toBe("tentative");
        const declined = await request(app).patch(`/api/v1/events/${created.body.data._id}/response`).set("X-Calendar-Profile", String(user03._id)).send({ status: "declined" });
        expect(declined.body.data.responseStatus).toBe("declined");

        const organizerView = await request(app).get(`/api/v1/events/${created.body.data._id}`).set("X-Calendar-Profile", String(owner._id));
        expect(organizerView.body.data.responseStatus).toBeUndefined();
        expect(organizerView.body.data.responseSummary).toEqual({ needsAction: 0, accepted: 0, declined: 1, tentative: 1 });
        expect(organizerView.body.data.participantPeople).toEqual(expect.arrayContaining([
            expect.objectContaining({ name: "Jordan Smith", responseStatus: "tentative" }),
            expect.objectContaining({ name: "Taylor Johnson", responseStatus: "declined" }),
        ]));
    });

    test("expands recurring events and applies attendee responses to this, following, or all occurrences", async () => {
        const [owner, attendee] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5", isProfile: true }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#7b1fa2", isProfile: true }),
        ]);
        const ownerCalendar = await Calendar.create({ ownerId: owner._id, name: "Owner calendar", color: "#039be5", visible: true, isPrimary: true });
        const created = await request(app).post("/api/v1/events").set("X-Calendar-Profile", String(owner._id)).send({
            ...eventPayload(), calendarId: String(ownerCalendar._id), participantIds: [String(attendee._id)], participants: [attendee.name],
            recurrence: { frequency: "daily", interval: 1, daysOfWeek: [], monthlyMode: "ordinalWeekday", endType: "count", count: 3, until: null, timeZone: "UTC" },
        });
        expect(created.status).toBe(201);
        const endpoint = `/api/v1/events/${created.body.data._id}/response`;
        const list = () => request(app).get(`/api/v1/events?from=2026-08-27T00:00:00.000Z&to=2026-08-30T00:00:00.000Z&calendarIds=${ownerCalendar._id}`).set("X-Calendar-Profile", String(attendee._id));
        let occurrences = (await list()).body.data;
        expect(occurrences).toHaveLength(3);
        expect(occurrences.every((item) => item.recurring && item.responseStatus === "needsAction")).toBe(true);

        await request(app).patch(endpoint).set("X-Calendar-Profile", String(attendee._id)).send({ status: "declined", scope: "this", occurrenceStartAt: occurrences[0].occurrenceStartAt });
        occurrences = (await list()).body.data;
        expect(occurrences.map((item) => item.responseStatus)).toEqual(["declined", "needsAction", "needsAction"]);

        await request(app).patch(endpoint).set("X-Calendar-Profile", String(attendee._id)).send({ status: "tentative", scope: "following", occurrenceStartAt: occurrences[1].occurrenceStartAt });
        occurrences = (await list()).body.data;
        expect(occurrences.map((item) => item.responseStatus)).toEqual(["declined", "tentative", "tentative"]);

        await request(app).patch(endpoint).set("X-Calendar-Profile", String(attendee._id)).send({ status: "accepted", scope: "all" });
        expect((await list()).body.data.map((item) => item.responseStatus)).toEqual(["accepted", "accepted", "accepted"]);

        const invalid = await request(app).post("/api/v1/events").send({ ...eventPayload(), recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [], endType: "never", timeZone: "UTC" } });
        expect(invalid.status).toBe(400);
        expect((await request(app).post("/api/v1/events").send({ ...eventPayload(), recurrence: { frequency: "daily", interval: 1, daysOfWeek: [], endType: "never", timeZone: "Mars/Olympus" } })).status).toBe(400);
        expect((await request(app).post("/api/v1/events").send({ ...eventPayload(), recurrence: { frequency: "daily", interval: 1, daysOfWeek: [], endType: "until", until: "2026-08-01T00:00:00.000Z", timeZone: "UTC" } })).body.error.code).toBe("INVALID_RECURRENCE_END");
        expect((await request(app).patch(endpoint).set("X-Calendar-Profile", String(attendee._id)).send({ status: "accepted", scope: "this", occurrenceStartAt: "2026-08-27T09:01:00.000Z" })).body.error.code).toBe("INVALID_OCCURRENCE");
    });

    test("preserves retained responses, adds new guests as pending, and resets answers after schedule changes", async () => {
        const [owner, user02, user03] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5", isProfile: true }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#7b1fa2", isProfile: true }),
            personPayload({ isProfile: true }),
        ]);
        const ownerCalendar = await Calendar.create({ ownerId: owner._id, name: "Owner calendar", color: "#039be5", visible: true, isPrimary: true });
        const event = await Event.create({ ...eventPayload(), calendarId: ownerCalendar._id, participantIds: [user02._id], participants: [user02.name], attendeeResponses: [{ personId: user02._id, status: "accepted", respondedAt: new Date() }] });

        const guestsChanged = await request(app).patch(`/api/v1/events/${event._id}`).set("X-Calendar-Profile", String(owner._id)).send({ participantIds: [String(user02._id), String(user03._id)], participants: [user02.name, user03.name] });
        expect(guestsChanged.body.data.participantPeople).toEqual([
            expect.objectContaining({ name: "Jordan Smith", responseStatus: "accepted" }),
            expect.objectContaining({ name: "Taylor Johnson", responseStatus: "needsAction" }),
        ]);

        const rescheduled = await request(app).patch(`/api/v1/events/${event._id}`).set("X-Calendar-Profile", String(owner._id)).send({ startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z" });
        expect(rescheduled.body.data.responseSummary).toEqual({ needsAction: 2, accepted: 0, declined: 0, tentative: 0 });
        expect(rescheduled.body.data.attendeeResponses.every((response) => response.respondedAt === null)).toBe(true);
    });

    test("keeps guest responses when an edit does not move the event", async () => {
        const [owner, guest] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5", isProfile: true }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#7b1fa2", isProfile: true }),
        ]);
        const ownerCalendar = await Calendar.create({ ownerId: owner._id, name: "Owner calendar", color: "#039be5", visible: true, isPrimary: true });
        const respondedAt = new Date("2026-08-20T12:00:00.000Z");
        const event = await Event.create({
            ...eventPayload(),
            calendarId: ownerCalendar._id,
            recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [4], endType: "count", count: 10, timeZone: "UTC" },
            participantIds: [guest._id],
            participants: [guest.name],
            attendeeResponses: [{ personId: guest._id, status: "accepted", respondedAt }],
            recurrenceResponseOverrides: [{ personId: guest._id, occurrenceStartAt: new Date("2026-09-03T09:00:00.000Z"), scope: "this", status: "declined", respondedAt }],
        });
        const patch = (body) => request(app).patch(`/api/v1/events/${event._id}`).set("X-Calendar-Profile", String(owner._id)).send(body);

        const renamed = await patch({ title: "Design review v2" });
        expect(renamed.body.data.responseSummary).toEqual({ needsAction: 0, accepted: 1, declined: 0, tentative: 0 });

        const resent = await patch({
            title: "Design review v3",
            startAt: "2026-08-27T09:00:00.000Z",
            endAt: "2026-08-27T10:00:00.000Z",
            allDay: false,
            recurrence: { frequency: "weekly", interval: 1, daysOfWeek: [4], monthlyMode: "ordinalWeekday", endType: "count", count: 10, until: null, timeZone: "UTC" },
            participantIds: [String(guest._id)],
            participants: [guest.name],
        });
        expect(resent.body.data.responseSummary).toEqual({ needsAction: 0, accepted: 1, declined: 0, tentative: 0 });
        expect(resent.body.data.recurrenceResponseOverrides).toHaveLength(1);

        const moved = await patch({ startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T12:00:00.000Z" });
        expect(moved.body.data.responseSummary).toEqual({ needsAction: 1, accepted: 0, declined: 0, tentative: 0 });
        expect(moved.body.data.recurrenceResponseOverrides).toHaveLength(0);
    });

    test("rejects invalid, unauthenticated, organizer, non-attendee, and stale invitation responses", async () => {
        const [owner, attendee, outsider] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5", isProfile: true }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#7b1fa2", isProfile: true }),
            personPayload({ isProfile: true }),
        ]);
        const ownerCalendar = await Calendar.create({ ownerId: owner._id, name: "Owner calendar", color: "#039be5", visible: true, isPrimary: true });
        const event = await Event.create({ ...eventPayload(), calendarId: ownerCalendar._id, participantIds: [attendee._id], participants: [attendee.name] });
        const endpoint = `/api/v1/events/${event._id}/response`;
        expect((await request(app).patch(endpoint).send({ status: "accepted" })).body.error.code).toBe("PROFILE_REQUIRED");
        expect((await request(app).patch(endpoint).set("X-Calendar-Profile", String(owner._id)).send({ status: "accepted" })).body.error.code).toBe("NOT_EVENT_ATTENDEE");
        expect((await request(app).patch(endpoint).set("X-Calendar-Profile", String(outsider._id)).send({ status: "declined" })).status).toBe(403);
        expect((await request(app).patch(endpoint).set("X-Calendar-Profile", String(attendee._id)).send({ status: "later" })).status).toBe(400);
        expect((await request(app).patch(endpoint).set("X-Calendar-Profile", String(attendee._id)).send({ status: "accepted", extra: true })).status).toBe(400);
        expect((await request(app).patch(`/api/v1/events/not-an-id/response`).set("X-Calendar-Profile", String(attendee._id)).send({ status: "accepted" })).body.error.code).toBe("EVENT_NOT_FOUND");
    });
});

describe("time insights", () => {
    test("aggregates a daily breakdown and ignores working locations", async () => {
        await Event.create([
            { ...eventPayload(), title: "Team sync", startAt: "2026-08-27T09:00:00.000Z", endAt: "2026-08-27T09:30:00.000Z" },
            { ...eventPayload(), title: "Deep work", type: "focusTime", startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z" },
            { ...eventPayload(), title: "Follow up", type: "task", startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T11:30:00.000Z" },
            { ...eventPayload(), title: "Office", type: "workingLocation", allDay: true, startAt: "2026-08-27T00:00:00.000Z", endAt: "2026-08-28T00:00:00.000Z" },
        ]);
        const response = await request(app).get(`/api/v1/insights/daily?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(expect.objectContaining({
            workingDayMinutes: 480,
            totalScheduledMinutes: 120,
            meetingMinutes: 30,
            meetingCount: 1,
            averageDailyMeetingMinutes: 4,
            remainingMinutes: 360,
        }));
        expect(Object.fromEntries(response.body.data.categories.map((category) => [category.key, category.minutes]))).toEqual({ meetings: 30, focus: 60, tasks: 30, outOfOffice: 0 });
        expect(response.body.data.calendars).toEqual([expect.objectContaining({ name: "My calendar", color: "#1a73e8", minutes: 120 })]);
    });

    test("counts an all-day out of office only on the days it actually covers", async () => {
        await Event.create([
            { ...eventPayload(), title: "Out of office", type: "outOfOffice", allDay: true, startAt: "2026-08-22T00:00:00.000Z", endAt: "2026-08-23T00:00:00.000Z" },
        ]);
        const quietDay = await request(app).get(`/api/v1/insights/daily?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(quietDay.body.data.totalScheduledMinutes).toBe(0);
        expect(quietDay.body.data.remainingMinutes).toBe(480);

        const coveredDay = await request(app).get(`/api/v1/insights/daily?from=2026-08-22T00:00:00.000Z&to=2026-08-23T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(coveredDay.body.data.categories.find((category) => category.key === "outOfOffice").minutes).toBe(480);
    });

    test("scopes the breakdown to the signed-in profile's own calendars", async () => {
        const [owner, other] = await Person.create([
            personPayload({ name: "Alex Morgan", email: "alex.morgan@calendar.com", isProfile: true }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", isProfile: true }),
        ]);
        const [ownerCalendar, otherCalendar] = await Calendar.create([
            { ownerId: owner._id, name: "Owner calendar", color: "#039be5", visible: true, isPrimary: true },
            { ownerId: other._id, name: "Other calendar", color: "#7b1fa2", visible: true, isPrimary: true },
        ]);
        await Event.create([
            { ...eventPayload(), calendarId: ownerCalendar._id, title: "Mine", startAt: "2026-08-27T09:00:00.000Z", endAt: "2026-08-27T10:00:00.000Z" },
            { ...eventPayload(), calendarId: otherCalendar._id, title: "Theirs", startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T12:00:00.000Z" },
        ]);

        const scoped = await request(app).get("/api/v1/insights/daily?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z").set("X-Calendar-Profile", String(owner._id));
        expect(scoped.body.data.meetingMinutes).toBe(60);
        expect(scoped.body.data.calendars.map((calendar) => calendar.name)).toEqual(["Owner calendar"]);

        const forged = await request(app).get(`/api/v1/insights/daily?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${otherCalendar._id}`).set("X-Calendar-Profile", String(owner._id));
        expect(forged.body.data.meetingMinutes).toBe(0);
        expect(forged.body.data.calendars).toEqual([]);
    });

    test("rejects invalid insight ranges and calendar identifiers", async () => {
        const range = await request(app).get(`/api/v1/insights/daily?from=2026-08-28T00:00:00.000Z&to=2026-08-27T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(range.status).toBe(400);
        expect(range.body.error.code).toBe("VALIDATION_ERROR");
        const identifier = await request(app).get("/api/v1/insights/daily?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=invalid");
        expect(identifier.status).toBe(400);
    });

    test("clips cross-boundary events and caps all-day out-of-office time", async () => {
        await Event.create([
            { ...eventPayload(), title: "Cross-boundary meeting", startAt: "2026-08-26T23:30:00.000Z", endAt: "2026-08-27T00:30:00.000Z" },
            { ...eventPayload(), title: "Appointment", type: "appointmentSchedule", startAt: "2026-08-27T12:00:00.000Z", endAt: "2026-08-27T12:45:00.000Z" },
            { ...eventPayload(), title: "Away", type: "outOfOffice", allDay: true, startAt: "2026-08-27T00:00:00.000Z", endAt: "2026-08-28T00:00:00.000Z" },
        ]);
        const response = await request(app).get(`/api/v1/insights/daily?from=2026-08-27T00:00:00.000Z&to=2026-08-28T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(response.body.data.meetingMinutes).toBe(75);
        expect(response.body.data.totalScheduledMinutes).toBe(555);
        expect(response.body.data.remainingMinutes).toBe(0);
        expect(response.body.data.categories.find((category) => category.key === "outOfOffice").minutes).toBe(480);
    });

    test("returns a stable zero-data insight snapshot", async () => {
        const response = await request(app).get(`/api/v1/insights/daily?from=2026-09-01T00:00:00.000Z&to=2026-09-02T00:00:00.000Z&calendarIds=${primary._id}`);
        expect(response.status).toBe(200);
        expect(response.body.data).toEqual(expect.objectContaining({ totalScheduledMinutes: 0, meetingMinutes: 0, meetingCount: 0, remainingMinutes: 480, calendars: [] }));
        expect(response.body.data.categories.every((category) => category.minutes === 0)).toBe(true);
    });
});

describe("people and availability", () => {
    test("searches the directory by name and email without treating regex characters as patterns", async () => {
        await Person.create([
            personPayload(),
            personPayload({ name: "Jordan Smith", email: "jordan.smith+desk@calendar.com", avatarColor: "#1a73e8" }),
        ]);
        const name = await request(app).get("/api/v1/people?q=Taylor Johnson");
        expect(name.status).toBe(200);
        expect(name.body.data.map((person) => person.name)).toEqual(["Taylor Johnson"]);
        expect(name.body.data[0].busyBlocks).toBeUndefined();
        const literal = await request(app).get("/api/v1/people?q=%2Bdesk");
        expect(literal.body.data.map((person) => person.name)).toEqual(["Jordan Smith"]);
    });

    test("returns a bounded sorted directory and validates query limits", async () => {
        await Person.create([
            personPayload({ name: "Casey Bennett", email: "casey.bennett@calendar.com" }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#1a73e8" }),
        ]);
        const response = await request(app).get("/api/v1/people?limit=1");
        expect(response.status).toBe(200);
        expect(response.body.data.map((person) => person.name)).toEqual(["Casey Bennett"]);
        expect((await request(app).get("/api/v1/people?limit=0")).status).toBe(400);
    });

    test("suggests only conflict-free shared-working-hour slots", async () => {
        const [user03, user02] = await Person.create([
            personPayload({ busyBlocks: [{ title: "Review", startAt: "2099-08-27T10:00:00.000Z", endAt: "2099-08-27T11:00:00.000Z" }] }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#1a73e8", workingHours: { startMinute: 600, endMinute: 960 }, busyBlocks: [{ title: "Stand-up", startAt: "2099-08-27T11:00:00.000Z", endAt: "2099-08-27T11:30:00.000Z" }] }),
        ]);
        await Event.create({ ...eventPayload(), title: "Owner conflict", startAt: "2099-08-27T12:00:00.000Z", endAt: "2099-08-27T13:00:00.000Z" });
        const response = await request(app).post("/api/v1/availability/suggestions").send({
            participantIds: [String(user03._id), String(user02._id)],
            from: "2099-08-27",
            timeZone: "UTC",
            days: 1,
            durationMinutes: 60,
        });
        expect(response.status).toBe(200);
        expect(response.body.data.participants).toHaveLength(2);
        expect(response.body.data.owner.busy).toHaveLength(1);
        expect(response.body.data.suggestions).not.toHaveLength(0);
        for (const suggestion of response.body.data.suggestions) {
            const start = new Date(suggestion.startAt).getUTCHours();
            expect(start).toBeGreaterThanOrEqual(10);
            expect(start).toBeLessThan(16);
            expect(start).not.toBe(10);
            expect(start).not.toBe(11);
            expect(start).not.toBe(12);
            expect(suggestion.attendeeCount).toBe(3);
        }
    });

    test("uses each participant's local hours across DST and returns comparison windows", async () => {
        const person = await Person.create(personPayload({
            timeZone: "America/New_York",
            workingHours: { startMinute: 540, endMinute: 1020 },
        }));
        const response = await request(app).post("/api/v1/availability/suggestions").send({
            participantIds: [String(person._id)],
            from: "2099-03-09",
            timeZone: "America/New_York",
            days: 1,
            durationMinutes: 60,
        });
        expect(response.status).toBe(200);
        expect(response.body.data.participants[0]).toEqual(expect.objectContaining({
            person: expect.objectContaining({ timeZone: "America/New_York", workingHours: { startMinute: 540, endMinute: 1020 } }),
            workingIntervals: [{ startAt: "2099-03-09T13:00:00.000Z", endAt: "2099-03-09T21:00:00.000Z" }],
        }));
        expect(response.body.data.suggestions[0].startAt).toBe("2099-03-09T13:00:00.000Z");
    });

    test("validates suggestion participants, duration, range, duplicates, and missing people", async () => {
        const person = await Person.create(personPayload());
        const endpoint = "/api/v1/availability/suggestions";
        expect((await request(app).post(endpoint).send({ participantIds: [], from: "2099-08-27", timeZone: "UTC", durationMinutes: 30 })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ participantIds: [String(person._id)], from: "bad-date", timeZone: "UTC", durationMinutes: 30 })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ participantIds: [String(person._id)], from: "2099-08-27", timeZone: "Mars/Olympus", durationMinutes: 30 })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ participantIds: [String(person._id)], from: "2099-08-27", timeZone: "UTC", durationMinutes: 22 })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ participantIds: [String(person._id), String(person._id)], from: "2099-08-27", timeZone: "UTC", durationMinutes: 30 })).status).toBe(400);
        const malformed = await request(app).post(endpoint).send({ participantIds: ["bad-id"], from: "2099-08-27", timeZone: "UTC", durationMinutes: 30 });
        expect(malformed.status).toBe(400);
        expect(malformed.body.error.code).toBe("INVALID_PERSON_ID");
        const missing = await request(app).post(endpoint).send({ participantIds: [String(new mongoose.Types.ObjectId())], from: "2099-08-27", timeZone: "UTC", durationMinutes: 30 });
        expect(missing.status).toBe(404);
        expect(missing.body.error.code).toBe("PEOPLE_NOT_FOUND");
    });

    test("returns a stable empty result when every valid slot is busy", async () => {
        const person = await Person.create(personPayload({ busyBlocks: [{ title: "All day workshop", startAt: "2099-08-27T00:00:00.000Z", endAt: "2099-08-28T00:00:00.000Z" }] }));
        const response = await request(app).post("/api/v1/availability/suggestions").send({ participantIds: [String(person._id)], from: "2099-08-27", timeZone: "UTC", days: 1, durationMinutes: 30 });
        expect(response.status).toBe(200);
        expect(response.body.data.suggestions).toEqual([]);
    });

    test("reports only guests whose busy blocks overlap the proposed event", async () => {
        const [user03, user02] = await Person.create([
            personPayload({ busyBlocks: [{ title: "Design review", startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z" }] }),
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#1a73e8", busyBlocks: [{ title: "Later meeting", startAt: "2026-08-27T12:00:00.000Z", endAt: "2026-08-27T13:00:00.000Z" }] }),
        ]);
        const response = await request(app).post("/api/v1/availability/conflicts").send({
            participantIds: [String(user03._id), String(user02._id)],
            startAt: "2026-08-27T10:30:00.000Z",
            endAt: "2026-08-27T11:30:00.000Z",
        });
        expect(response.status).toBe(200);
        expect(response.body.data.available).toBe(false);
        expect(response.body.data.conflicts).toEqual([expect.objectContaining({
            person: expect.objectContaining({ name: "Taylor Johnson" }),
            busy: [expect.objectContaining({ title: "Design review", startAt: "2026-08-27T10:30:00.000Z", endAt: "2026-08-27T11:00:00.000Z" })],
        })]);
    });

    test("reports free-but-outside-hours guests separately in their own time zones", async () => {
        const person = await Person.create(personPayload({ timeZone: "America/New_York", workingHours: { startMinute: 540, endMinute: 1020 } }));
        const outside = await request(app).post("/api/v1/availability/conflicts").send({
            participantIds: [String(person._id)],
            startAt: "2026-08-27T12:30:00.000Z",
            endAt: "2026-08-27T13:30:00.000Z",
            timeZone: "Asia/Kolkata",
        });
        expect(outside.body.data).toEqual(expect.objectContaining({ available: true, conflicts: [], withinWorkingHours: false }));
        expect(outside.body.data.workingHoursWarnings).toEqual([expect.objectContaining({
            person: expect.objectContaining({ name: "Taylor Johnson", timeZone: "America/New_York" }),
            localStartMinute: 510,
            workingDay: true,
        })]);
        const inside = await request(app).post("/api/v1/availability/conflicts").send({
            participantIds: [String(person._id)],
            startAt: "2026-08-27T13:00:00.000Z",
            endAt: "2026-08-27T14:00:00.000Z",
            timeZone: "Asia/Kolkata",
        });
        expect(inside.body.data).toEqual(expect.objectContaining({ available: true, withinWorkingHours: true, workingHoursWarnings: [] }));
    });

    test("treats meetings created in Calendar as future guest conflicts", async () => {
        const person = await Person.create(personPayload());
        const created = await request(app).post("/api/v1/events").send({
            ...eventPayload(),
            title: "Guest planning",
            participants: [person.name],
            participantIds: [String(person._id)],
        });
        expect(created.status).toBe(201);
        expect(created.body.data.participantIds).toEqual([String(person._id)]);
        const response = await request(app).post("/api/v1/availability/conflicts").send({ participantIds: [String(person._id)], startAt: "2026-08-27T09:30:00.000Z", endAt: "2026-08-27T09:45:00.000Z" });
        expect(response.body.data.conflicts[0]).toEqual(expect.objectContaining({
            person: expect.objectContaining({ name: person.name }),
            busy: [expect.objectContaining({ _id: created.body.data._id, calendarId: String(primary._id), title: "Guest planning", description: "Review the release plan.", location: "Room Cedar" })],
        }));
        const unknown = await request(app).post("/api/v1/events").send({ ...eventPayload(), participantIds: [String(new mongoose.Types.ObjectId())] });
        expect(unknown.status).toBe(404);
        expect(unknown.body.error.code).toBe("PEOPLE_NOT_FOUND");
    });

    test("removes declined invitations from only that attendee's busy schedule", async () => {
        const [user02, user03] = await Person.create([
            personPayload({ name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#7b1fa2" }),
            personPayload(),
        ]);
        await Event.create({
            ...eventPayload(),
            title: "Shared planning",
            participantIds: [user02._id, user03._id],
            participants: [user02.name, user03.name],
            attendeeResponses: [
                { personId: user02._id, status: "declined", respondedAt: new Date() },
                { personId: user03._id, status: "accepted", respondedAt: new Date() },
            ],
        });
        const response = await request(app).post("/api/v1/availability/conflicts").send({ participantIds: [String(user02._id), String(user03._id)], startAt: "2026-08-27T09:15:00.000Z", endAt: "2026-08-27T09:45:00.000Z" });
        expect(response.body.data.conflicts.map((conflict) => conflict.person.name)).toEqual(["Taylor Johnson"]);
    });

    test("keeps directory identities aligned with legacy name-only guests", async () => {
        const person = await Person.create(personPayload({ name: "Taylor Johnson", email: "taylor.johnson@calendar.com" }));
        const created = await request(app).post("/api/v1/events").send({
            ...eventPayload(),
            participants: ["Saved User", "Taylor Johnson"],
            participantIds: [String(person._id)],
        });
        expect(created.status).toBe(201);
        expect(created.body.data.participants).toEqual(["Taylor Johnson", "Saved User"]);
        expect(created.body.data.participantPeople).toEqual([
            expect.objectContaining({ _id: String(person._id), name: "Taylor Johnson", email: "taylor.johnson@calendar.com" }),
            expect.objectContaining({ name: "Saved User", email: "" }),
        ]);
        const reopened = await request(app).get(`/api/v1/events/${created.body.data._id}`);
        expect(reopened.body.data.participantPeople[0]).toEqual(expect.objectContaining({ _id: String(person._id), name: "Taylor Johnson" }));
        expect(reopened.body.data.participantPeople[1].name).toBe("Saved User");
    });

    test("treats touching intervals as available and validates conflict requests", async () => {
        const person = await Person.create(personPayload({ busyBlocks: [{ title: "Review", startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z" }] }));
        const endpoint = "/api/v1/availability/conflicts";
        const available = await request(app).post(endpoint).send({ participantIds: [String(person._id)], startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T11:30:00.000Z" });
        expect(available.body.data).toEqual(expect.objectContaining({ available: true, conflicts: [] }));
        expect((await request(app).post(endpoint).send({ participantIds: [], startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z" })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ participantIds: [String(person._id)], startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T10:00:00.000Z" })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ participantIds: [String(person._id)], startAt: "2026-08-27T11:00:00.000Z", endAt: "2026-08-27T11:30:00.000Z", timeZone: "Mars/Olympus" })).status).toBe(400);
        expect((await request(app).post(endpoint).send({ participantIds: ["bad-id"], startAt: "2026-08-27T10:00:00.000Z", endAt: "2026-08-27T11:00:00.000Z" })).body.error.code).toBe("INVALID_PERSON_ID");
    });

    test("ignores free all-day metadata but blocks all-day out-of-office events", async () => {
        const person = await Person.create(personPayload());
        await Event.create({ ...eventPayload(), title: "Birthday", allDay: true, startAt: "2099-08-27T00:00:00.000Z", endAt: "2099-08-28T00:00:00.000Z" });
        const criteria = { participantIds: [String(person._id)], from: "2099-08-27", timeZone: "UTC", days: 1, durationMinutes: 30 };
        const withMetadata = await request(app).post("/api/v1/availability/suggestions").send(criteria);
        expect(withMetadata.body.data.suggestions.length).toBeGreaterThan(0);
        await Event.create({ ...eventPayload(), title: "Out of office", type: "outOfOffice", allDay: true, startAt: "2099-08-27T00:00:00.000Z", endAt: "2099-08-28T00:00:00.000Z" });
        const outOfOffice = await request(app).post("/api/v1/availability/suggestions").send(criteria);
        expect(outOfOffice.body.data.suggestions).toEqual([]);
    });
});

describe("errors", () => {
    test("uses a stable not-found envelope", async () => {
        const response = await request(app).get("/api/v1/unknown");
        expect(response.status).toBe(404);
        expect(response.body.error.code).toBe("NOT_FOUND");
    });
});
