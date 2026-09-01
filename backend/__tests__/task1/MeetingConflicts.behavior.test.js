import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../.env") });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { Calendar } from "../../src/features/calendars/calendar.model.js";
import { Event } from "../../src/features/events/event.model.js";
import { Person } from "../../src/features/people/person.model.js";
import { WorkspaceAccount } from "../../src/features/auth/workspace-account.model.js";
import { loadConfig } from "../../src/shared/config/index.js";

const config = loadConfig(true);
const app = createApp();

const ORGANIZER_EMAIL = "alex.morgan@calendar.com";
const DEMO_PASSWORD = "password123";
const MONDAY = "2030-01-07";
const at = (date, time) => `${date}T${time}:00.000Z`;

let organizer;
let guestOne;
let guestTwo;
let guestThree;
let bystander;
let organizerCalendar;
let guestCalendar;
let organizerToken;

const checkConflicts = (people, startAt, endAt) => request(app).post("/api/v1/availability/conflicts")
    .set("Authorization", `Bearer ${organizerToken}`)
    .send({
        participantIds: people.map((person) => String(person._id)),
        startAt,
        endAt,
        timeZone: "UTC",
    });

const suggestTimes = (profile, people) => request(app).post("/api/v1/availability/suggestions")
    .set("Authorization", `Bearer ${organizerToken}`)
    .send({ participantIds: people.map((person) => String(person._id)), from: MONDAY, timeZone: "UTC", days: 1, durationMinutes: 30 });

const guestEvent = (values) => ({
    calendarId: guestCalendar._id,
    organizer: guestOne.name,
    type: "event",
    allDay: false,
    ...values,
});

const busyIds = (body) => body.data.conflicts.map((conflict) => String(conflict.person._id));

beforeAll(async () => {
    await mongoose.connect(config.mongodbUri);
});

beforeEach(async () => {
    await Promise.all([Calendar.deleteMany({}), Event.deleteMany({}), Person.deleteMany({}), WorkspaceAccount.deleteMany({})]);
    [organizer, guestOne, guestTwo, guestThree, bystander] = await Person.create([
        { name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: "#039be5", isProfile: true, sortOrder: 1 },
        { name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: "#e37400", isProfile: true, sortOrder: 2 },
        { name: "Taylor Johnson", email: "taylor.johnson@calendar.com", avatarColor: "#d93025", isProfile: true, sortOrder: 3 },
        { name: "Riley Parker", email: "riley.parker@calendar.com", avatarColor: "#7e57c2", isProfile: true, sortOrder: 4 },
        { name: "Casey Bennett", email: "casey.bennett@calendar.com", avatarColor: "#0f9d58", isProfile: true, sortOrder: 5 },
    ]);
    [organizerCalendar, guestCalendar] = await Calendar.create([
        { ownerId: organizer._id, name: "My calendar", color: "#039be5", visible: true, isPrimary: true },
        { ownerId: guestOne._id, name: "My calendar", color: "#e37400", visible: true, isPrimary: true },
    ]);
    await WorkspaceAccount.create({
        name: organizer.name,
        email: ORGANIZER_EMAIL,
        passwordHash: await bcrypt.hash(DEMO_PASSWORD, 4),
        allowedProfileIds: [organizer._id, guestOne._id, guestTwo._id, guestThree._id, bystander._id],
    });
    const login = await request(app).post("/api/v1/auth/login").send({ email: ORGANIZER_EMAIL, password: DEMO_PASSWORD });
    const switched = await request(app).post("/api/v1/auth/switch-profile")
        .set("Authorization", `Bearer ${login.body.data.token}`)
        .send({ profileId: String(organizer._id) });
    organizerToken = switched.body.data.token;
});

afterAll(async () => {
    const collections = mongoose.connection.collections;
    for (const key of Object.keys(collections)) await collections[key].deleteMany({});
    await mongoose.disconnect();
});

describe("meeting conflicts", () => {
    it("should report a clash only when the proposed time genuinely overlaps a busy block", async () => {
        await Person.updateOne({ _id: guestOne._id }, { $set: { busyBlocks: [{ title: "Design sync", startAt: new Date(at(MONDAY, "10:00")), endAt: new Date(at(MONDAY, "11:00")) }] } });

        // A meeting that starts exactly when theirs ends does not clash
        const backToBack = await checkConflicts([guestOne], at(MONDAY, "11:00"), at(MONDAY, "11:30"));
        expect(backToBack.status).toBe(200);
        expect(backToBack.body.data.available).toBe(true);
        expect(backToBack.body.data.conflicts).toEqual([]);

        // A meeting that completely surrounds theirs does
        const surrounding = await checkConflicts([guestOne], at(MONDAY, "09:00"), at(MONDAY, "12:00"));
        expect(surrounding.status).toBe(200);
        expect(surrounding.body.data.available).toBe(false);
        expect(busyIds(surrounding.body)).toEqual([String(guestOne._id)]);
    });

    it("should treat invitations that were not declined as busy time for that guest only", async () => {
        await Event.create({
            calendarId: organizerCalendar._id,
            organizer: organizer.name,
            type: "event",
            title: "Release readiness",
            allDay: false,
            startAt: new Date(at(MONDAY, "14:00")),
            endAt: new Date(at(MONDAY, "15:00")),
            participants: [guestOne.name, guestTwo.name, guestThree.name],
            participantIds: [guestOne._id, guestTwo._id, guestThree._id],
            attendeeResponses: [
                { personId: guestOne._id, status: "needsAction", respondedAt: null },
                { personId: guestTwo._id, status: "tentative", respondedAt: new Date(at(MONDAY, "09:00")) },
                { personId: guestThree._id, status: "declined", respondedAt: new Date(at(MONDAY, "09:00")) },
            ],
        });

        // No reply and Maybe are busy; Declined is free; an uninvited person is never reported
        const response = await checkConflicts([guestOne, guestTwo, guestThree, bystander], at(MONDAY, "14:15"), at(MONDAY, "14:45"));
        expect(response.status).toBe(200);
        expect(response.body.data.available).toBe(false);
        const busy = busyIds(response.body);
        expect(busy).toContain(String(guestOne._id));
        expect(busy).toContain(String(guestTwo._id));
        expect(busy).not.toContain(String(guestThree._id));
        expect(busy).not.toContain(String(bystander._id));
    });

    it("should treat an all-day out-of-office as busy while other all-day items stay free", async () => {
        await Event.create([
            guestEvent({ title: "Out of office", type: "outOfOffice", allDay: true, startAt: new Date(at(MONDAY, "00:00")), endAt: new Date(at("2030-01-08", "00:00")) }),
            guestEvent({ title: "Home", type: "workingLocation", allDay: true, startAt: new Date(at(MONDAY, "00:00")), endAt: new Date(at("2030-01-08", "00:00")) }),
            guestEvent({ title: "Company offsite", type: "event", allDay: true, startAt: new Date(at(MONDAY, "00:00")), endAt: new Date(at("2030-01-08", "00:00")) }),
        ]);

        // Of the three all-day items only Out of office consumes availability
        const response = await checkConflicts([guestOne], at(MONDAY, "11:00"), at(MONDAY, "11:30"));
        expect(response.status).toBe(200);
        expect(response.body.data.available).toBe(false);
        expect(response.body.data.conflicts[0].busy).toHaveLength(1);
        expect(response.body.data.conflicts[0].busy[0].type).toBe("outOfOffice");
    });

    it("should report every occurrence of a recurring meeting as busy", async () => {
        await Event.create(guestEvent({
            title: "Weekly planning",
            startAt: new Date(at(MONDAY, "10:00")),
            endAt: new Date(at(MONDAY, "10:30")),
            recurrence: { frequency: "weekly", interval: 1, endType: "count", count: 5, timeZone: "UTC" },
        }));

        // The third week is busy even though only the first is stored
        const thirdOccurrence = await checkConflicts([guestOne], at("2030-01-21", "10:00"), at("2030-01-21", "10:30"));
        expect(thirdOccurrence.status).toBe(200);
        expect(thirdOccurrence.body.data.available).toBe(false);
        expect(thirdOccurrence.body.data.conflicts[0].busy).toHaveLength(1);

        // The day after an occurrence is free, so reporting the whole week fails too
        const dayAfter = await checkConflicts([guestOne], at("2030-01-22", "10:00"), at("2030-01-22", "10:30"));
        expect(dayAfter.status).toBe(200);
        expect(dayAfter.body.data.available).toBe(true);
    });

    it("should clip each reported busy block to the proposed meeting window", async () => {
        await Event.create(guestEvent({ title: "Out of office", type: "outOfOffice", allDay: true, startAt: new Date(at(MONDAY, "00:00")), endAt: new Date(at("2030-01-08", "00:00")) }));

        const response = await checkConflicts([guestOne], at(MONDAY, "11:00"), at(MONDAY, "11:30"));
        expect(response.status).toBe(200);
        // The guest is out all day; only the half hour being planned may be reported
        const [block] = response.body.data.conflicts[0].busy;
        expect(block.startAt).toBe(at(MONDAY, "11:00"));
        expect(block.endAt).toBe(at(MONDAY, "11:30"));
    });

    it("should never suggest a time when the organizer or a guest is already busy", async () => {
        await Event.create({
            calendarId: organizerCalendar._id,
            organizer: organizer.name,
            type: "event",
            title: "Metrics review",
            allDay: false,
            startAt: new Date(at("2029-12-17", "10:00")),
            endAt: new Date(at("2029-12-17", "11:00")),
            recurrence: { frequency: "weekly", interval: 1, endType: "count", count: 8, timeZone: "UTC" },
        });
        await Event.create(guestEvent({ title: "Focus time", startAt: new Date(at(MONDAY, "09:00")), endAt: new Date(at(MONDAY, "09:30")) }));

        // 10:00 and 10:30 are the organizer's own meeting, 09:00 is the guest's
        const response = await suggestTimes(organizer, [guestOne]);
        expect(response.status).toBe(200);
        expect(response.body.data.owner.busy).toHaveLength(1);
        const starts = response.body.data.suggestions.map((suggestion) => suggestion.startAt);
        expect(starts).toContain(at(MONDAY, "11:30"));
        expect(starts).not.toContain(at(MONDAY, "10:00"));
        expect(starts).not.toContain(at(MONDAY, "10:30"));
        expect(starts).not.toContain(at(MONDAY, "09:00"));
    });
});
