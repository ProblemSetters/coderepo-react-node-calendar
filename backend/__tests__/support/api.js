import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { initConfig } from "../../src/shared/config/index.js";
import { WorkspaceAccount } from "../../src/features/auth/workspace-account.model.js";
import { Calendar } from "../../src/features/calendars/calendar.model.js";
import { Event } from "../../src/features/events/event.model.js";
import { Person } from "../../src/features/people/person.model.js";

const MODELS = [WorkspaceAccount, Person, Calendar, Event];
// The app hashes with its own cost. Tests only need a valid hash, so they use the cheapest one.
const TEST_HASH_ROUNDS = 4;

export const PASSWORD = "Calendar#2026";
export const WORKING_HOURS = { startMinute: 9 * 60, endMinute: 17 * 60 };

let app;

export function api() {
    app ??= createApp();
    return request(app);
}

export async function openDatabase() {
    initConfig();
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
    // Builds every declared index before a test relies on it, such as the unique calendar name.
    await Promise.all(MODELS.map((model) => model.init()));
}

export async function resetDatabase() {
    await Promise.all(MODELS.map((model) => model.deleteMany({})));
}

export async function closeDatabase() {
    await mongoose.disconnect();
}

async function createProfile(name, email, sortOrder) {
    return Person.create({ name, email, avatarColor: "#1a73e8", isProfile: true, sortOrder, timeZone: "UTC", workingHours: WORKING_HOURS });
}

async function createAccount(profile, allowedProfiles = [profile]) {
    return WorkspaceAccount.create({
        name: profile.name,
        email: profile.email,
        passwordHash: await bcrypt.hash(PASSWORD, TEST_HASH_ROUNDS),
        allowedProfileIds: allowedProfiles.map((person) => person._id),
    });
}

// Three people, each signing in with an account that may use only their own profile. Each owns a
// primary calendar; Alex also owns a second one.
export async function createWorkspace() {
    const alex = await createProfile("Alex Morgan", "alex@calendar.test", 1);
    const jordan = await createProfile("Jordan Smith", "jordan@calendar.test", 2);
    const taylor = await createProfile("Taylor Johnson", "taylor@calendar.test", 3);
    await Promise.all([createAccount(alex), createAccount(jordan), createAccount(taylor)]);
    const calendars = {
        alexPrimary: await Calendar.create({ ownerId: alex._id, name: "Alex Morgan", color: "#1a73e8", isPrimary: true }),
        alexWork: await Calendar.create({ ownerId: alex._id, name: "Work", color: "#0b8043" }),
        jordanPrimary: await Calendar.create({ ownerId: jordan._id, name: "Jordan Smith", color: "#8e24aa", isPrimary: true }),
        taylorPrimary: await Calendar.create({ ownerId: taylor._id, name: "Taylor Johnson", color: "#e67c73", isPrimary: true }),
    };
    return { people: { alex, jordan, taylor }, calendars };
}

export async function signInWorkspace(person) {
    const response = await api().post("/api/v1/auth/login").send({ email: person.email, password: PASSWORD });
    return response.body.data.token;
}

// Signs in and picks the person's own profile, like the sign-in screen does.
export async function signIn(person) {
    const workspaceToken = await signInWorkspace(person);
    const response = await api().post("/api/v1/auth/switch-profile").set("Authorization", `Bearer ${workspaceToken}`).send({ profileId: String(person._id) });
    return response.body.data.token;
}

export function as(token) {
    const authorize = (pending) => pending.set("Authorization", `Bearer ${token}`);
    return {
        get: (path) => authorize(api().get(path)),
        post: (path, body = {}) => authorize(api().post(path)).send(body),
        patch: (path, body = {}) => authorize(api().patch(path)).send(body),
        delete: (path) => authorize(api().delete(path)),
    };
}

export function eventBody(calendar, overrides = {}) {
    return {
        calendarId: String(calendar._id),
        title: "Design review",
        startAt: "2030-06-03T10:00:00.000Z",
        endAt: "2030-06-03T11:00:00.000Z",
        ...overrides,
    };
}

export function errorCode(response) {
    return response.body.error?.code;
}
