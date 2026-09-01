import dotenv from "dotenv";

dotenv.config({ quiet: true });

import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { WorkspaceAccount } from "../features/auth/workspace-account.model.js";
import { Calendar } from "../features/calendars/calendar.model.js";
import { Event } from "../features/events/event.model.js";
import { Person } from "../features/people/person.model.js";
import { loadConfig } from "../shared/config/index.js";
import { demoColorFor } from "../shared/constants/demo-colors.js";
import { addCalendarDays, dayOfWeek, localDateKey, partsAt, zonedDateTime } from "../shared/utils/time-zone.js";

const config = loadConfig(false);

const DEMO_TIME_ZONE = "UTC";
const DEMO_PASSWORD = "password123";
const PASSWORD_ROUNDS = 12;
const SPREAD_FIRST_DAY = -45;
const SPREAD_LAST_DAY = 60;
const SUPPORTED_TYPES = new Set(["event", "task", "outOfOffice", "focusTime", "workingLocation", "appointmentSchedule"]);

const todayKey = process.env.DEMO_TODAY || localDateKey(new Date(), DEMO_TIME_ZONE);
const dayKey = (dayOffset) => addCalendarDays(todayKey, dayOffset);
const date = (dayOffset, hour, minute = 0) => zonedDateTime(dayKey(dayOffset), hour * 60 + minute, DEMO_TIME_ZONE);
const isWeekend = (dayOffset) => [0, 6].includes(dayOfWeek(dayKey(dayOffset)));
const respondedAt = date(-2, 12);

const profileRows = [
    { name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: demoColorFor("alex.morgan@calendar.com"), isProfile: true, sortOrder: 1, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 540, endMinute: 1050 } },
    { name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: demoColorFor("jordan.smith@calendar.com"), isProfile: true, sortOrder: 2, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 540, endMinute: 1020 } },
    { name: "Taylor Johnson", email: "taylor.johnson@calendar.com", avatarColor: demoColorFor("taylor.johnson@calendar.com"), isProfile: true, sortOrder: 3, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 600, endMinute: 1080 } },
    { name: "Riley Parker", email: "riley.parker@calendar.com", avatarColor: demoColorFor("riley.parker@calendar.com"), isProfile: true, sortOrder: 4, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 480, endMinute: 990 } },
    { name: "Casey Bennett", email: "casey.bennett@calendar.com", avatarColor: demoColorFor("casey.bennett@calendar.com"), isProfile: true, sortOrder: 5, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 540, endMinute: 1020 } },
];

const recurrence = (frequency, options = {}) => ({ frequency, interval: 1, endType: "count", count: 20, timeZone: DEMO_TIME_ZONE, ...options });

const invited = (people, statuses = []) => ({
    participants: people.map((person) => person.name),
    participantIds: people.map((person) => person._id),
    attendeeResponses: people.map((person, index) => ({
        personId: person._id,
        status: statuses[index] || "needsAction",
        respondedAt: statuses[index] && statuses[index] !== "needsAction" ? respondedAt : null,
    })),
});

const weeklyDays = (details) => (
    details.recurrence?.frequency === "weekly" && !details.recurrence.daysOfWeek?.length
        ? { recurrence: { ...details.recurrence, daysOfWeek: [dayOfWeek(localDateKey(details.startAt, DEMO_TIME_ZONE))] } }
        : {}
);

async function clearDatabase() {
    console.log("Clearing existing collections...");
    await Promise.all([Event.deleteMany({}), Calendar.deleteMany({}), Person.deleteMany({}), WorkspaceAccount.deleteMany({})]);
    await Promise.all([Calendar.syncIndexes(), Person.syncIndexes(), Event.syncIndexes(), WorkspaceAccount.syncIndexes()]);
}

async function seedProfiles() {
    console.log("\nSeeding profiles...");
    const profiles = await Person.create(profileRows);
    console.log(`  Created ${profiles.length} profiles`);
    return profiles;
}

async function seedAccounts(profiles) {
    console.log("\nSeeding sign-in accounts...");
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, PASSWORD_ROUNDS);
    const allowedProfileIds = profiles.map((profile) => profile._id);
    const accounts = await WorkspaceAccount.create(profiles.map((profile) => ({
        name: profile.name,
        email: profile.email,
        passwordHash,
        allowedProfileIds,
    })));
    console.log(`  Created ${accounts.length} accounts, each able to open any of the ${profiles.length} profiles`);
    return accounts;
}

async function seedCalendars(profiles) {
    console.log("\nSeeding calendars...");
    const [alex] = profiles;
    const rows = profiles.flatMap((profile) => [
        { ownerId: profile._id, key: `${profile.email}:primary`, name: "My calendar", color: profile.avatarColor, visible: true, isPrimary: true },
        { ownerId: profile._id, key: `${profile.email}:work`, name: "Work", color: demoColorFor(profile.email, "work"), visible: true, isPrimary: false },
    ]);
    rows.push({ ownerId: alex._id, key: `${alex.email}:birthdays`, name: "Birthdays", color: demoColorFor(alex.email, "Birthdays"), visible: true, isPrimary: false });
    const created = await Calendar.create(rows.map(({ key, ...calendar }) => ({ ...calendar, defaultColor: calendar.color })));
    console.log(`  Created ${created.length} calendars`);
    return { created, byKey: new Map(rows.map((calendar, index) => [calendar.key, created[index]])) };
}

function buildEventRows(profiles, calendarsByKey) {
    const [alex, jordan, taylor, riley, casey] = profiles;
    const calendarFor = (profile, name = "primary") => calendarsByKey.get(`${profile.email}:${name}`);
    const event = (owner, values) => {
        const { calendar = "primary", ...details } = values;
        return {
            calendarId: calendarFor(owner, calendar)._id,
            organizer: owner.name,
            type: "event",
            description: "",
            location: "",
            ...details,
            ...weeklyDays(details),
        };
    };

    const recurringRows = [
    event(alex, { calendar: "work", title: "Weekly product planning", description: "Review priorities, risks, and the next delivery window.", location: "Conference room Maple", startAt: date(-7, 10), endAt: date(-7, 11), recurrence: recurrence("weekly"), ...invited([jordan, taylor, riley], ["accepted", "accepted", "tentative"]) }),
    event(alex, { title: "Office", type: "workingLocation", description: "Working from the office today.", location: "Office", startAt: date(-7, 0), endAt: date(-6, 0), allDay: true, recurrence: recurrence("weekly", { daysOfWeek: [2, 4] }) }),
    event(jordan, { calendar: "work", title: "Delivery stand-up", description: "Daily progress and blockers.", startAt: date(-8, 9, 15), endAt: date(-8, 9, 30), recurrence: recurrence("weekdays", { count: 60 }), ...invited([riley], ["accepted"]) }),
    event(jordan, { title: "Home", type: "workingLocation", description: "Working remotely.", location: "Home", startAt: date(-9, 0), endAt: date(-8, 0), allDay: true, recurrence: recurrence("weekly", { daysOfWeek: [1, 3] }) }),
    event(taylor, { calendar: "work", title: "Design critique", description: "Review the responsive Month and Week experiences.", location: "Studio", startAt: date(-6, 15), endAt: date(-6, 16), recurrence: recurrence("weekly", { count: 14 }), ...invited([casey], ["accepted"]) }),
    event(riley, { title: "One-on-one", description: "Weekly coaching conversation.", startAt: date(-5, 14), endAt: date(-5, 14, 30), recurrence: recurrence("weekly", { count: 16 }), ...invited([jordan], ["accepted"]) }),
    event(casey, { calendar: "work", title: "Launch check-in", description: "Confirm launch dependencies and owners.", startAt: date(-8, 11), endAt: date(-8, 11, 30), recurrence: recurrence("weekly", { count: 14 }), ...invited([alex, jordan], ["accepted", "accepted"]) }),
    ];

    const spreadTemplates = [
    { owner: alex, calendar: "work", title: "Design review", description: "Review the current product flow and resolve open decisions.", location: "Conference room Cedar", hour: 10, minutes: 60, guests: [taylor, casey], statuses: ["accepted", "tentative"] },
    { owner: alex, title: "Focus time", type: "focusTime", description: "Protected time for the release-readiness write-up.", hour: 14, minutes: 90 },
    { owner: alex, title: "Publish weekly update", type: "task", description: "Summarize decisions, owners, and next steps.", hour: 16, minutes: 30 },
    { owner: jordan, calendar: "work", title: "Project sync", description: "Review delivery status and clear blockers.", location: "Conference room Birch", hour: 9, minutes: 45, guests: [riley], statuses: ["accepted"] },
    { owner: jordan, title: "Customer discovery", description: "Understand the current scheduling workflow.", location: "Video call", hour: 13, minutes: 60, guests: [casey], statuses: ["accepted"] },
    { owner: taylor, title: "Research review", description: "Synthesize usability-study findings.", hour: 15, minutes: 60, guests: [alex], statuses: ["needsAction"] },
    { owner: taylor, title: "Prototype exploration", type: "focusTime", hour: 11, minutes: 120 },
    { owner: riley, calendar: "work", title: "Engineering review", description: "Review architecture, reliability, and rollout risks.", location: "Conference room Pine", hour: 11, minutes: 60, guests: [jordan, alex], statuses: ["accepted", "tentative"] },
    { owner: riley, title: "Incident drill", description: "Practice the service-recovery playbook.", location: "Operations room", hour: 15, minutes: 60 },
    { owner: casey, calendar: "work", title: "Campaign planning", description: "Coordinate launch messages and channel owners.", location: "Conference room Willow", hour: 12, minutes: 60, guests: [alex, taylor], statuses: ["accepted", "accepted"] },
    { owner: casey, title: "Editorial review", description: "Final review of the release announcement.", hour: 16, minutes: 60, guests: [taylor], statuses: ["tentative"] },
    { owner: alex, title: "Health appointment", description: "Annual preventive check-up.", location: "Community clinic", hour: 17, minutes: 60 },
    { owner: jordan, title: "Code review", type: "focusTime", description: "Review the authentication and recurrence changes.", hour: 15, minutes: 90 },
    { owner: taylor, title: "Update accessibility notes", type: "task", hour: 16, minutes: 30 },
    { owner: riley, title: "Rotate service credentials", type: "task", hour: 11, minutes: 30 },
    { owner: casey, title: "Agency call", description: "Review the next creative delivery.", location: "Video call", hour: 17, minutes: 45 },
    { owner: alex, calendar: "work", title: "Team roadmap", description: "Align priorities for the next milestone.", location: "Orchid", hour: 11, minutes: 60, guests: [jordan, taylor], statuses: ["accepted", "tentative"] },
    { owner: jordan, title: "Deep work", type: "focusTime", hour: 10, minutes: 120 },
    { owner: taylor, calendar: "work", title: "Content workshop", description: "Improve empty, loading, and error-state language.", location: "Conference room Elm", hour: 11, minutes: 90, guests: [alex, jordan], statuses: ["accepted", "declined"] },
    { owner: riley, calendar: "work", title: "Release readiness", description: "Verify tests, monitoring, and rollback steps.", hour: 10, minutes: 60, guests: [alex, jordan, taylor], statuses: ["accepted", "accepted", "needsAction"] },
    { owner: casey, title: "Write launch brief", type: "focusTime", hour: 10, minutes: 120 },
    { owner: alex, title: "Read research notes", type: "task", hour: 18, minutes: 30 },
    ];
    const workdayOffsets = [];
    for (let offset = SPREAD_FIRST_DAY; offset <= SPREAD_LAST_DAY; offset += 1) {
        if (!isWeekend(offset)) workdayOffsets.push(offset);
    }

    // Whether a repeating row lands on a day, judged from its pattern rather than by expanding it.
    const repeatCoversDay = (row, offset) => {
        const anchorKey = localDateKey(row.startAt, DEMO_TIME_ZONE);
        if (dayKey(offset) < anchorKey) return false;
        if (dayKey(offset) === anchorKey) return true;
        const frequency = row.recurrence?.frequency;
        if (frequency === "weekdays") return !isWeekend(offset);
        if (frequency === "weekly") return (row.recurrence.daysOfWeek || []).includes(dayOfWeek(dayKey(offset)));
        return false;
    };

    const minutesOf = (value) => { const at = partsAt(value, DEMO_TIME_ZONE); return at.hour * 60 + at.minute; };
    const hoursOf = (name) => profiles.find((profile) => profile.name === name).workingHours;

    const busy = new Map();
    const busyKey = (name, offset) => `${name}|${offset}`;
    const slotsFor = (name, offset) => busy.get(busyKey(name, offset)) || [];
    const reserve = (name, offset, startMinute, endMinute) => {
        busy.set(busyKey(name, offset), [...slotsFor(name, offset), { startMinute, endMinute }]);
    };
    const isFree = (name, offset, startMinute, endMinute) => !slotsFor(name, offset)
        .some((slot) => startMinute < slot.endMinute && endMinute > slot.startMinute);
    const isAway = (name, offset) => slotsFor(name, offset).some((slot) => slot.endMinute - slot.startMinute >= 24 * 60);

    for (const row of recurringRows) {
        if (row.allDay) continue;
        const startMinute = minutesOf(row.startAt);
        const endMinute = startMinute + (row.endAt - row.startAt) / 60000;
        for (const offset of workdayOffsets) {
            if (!repeatCoversDay(row, offset)) continue;
            for (const name of [row.organizer, ...(row.participants || [])]) reserve(name, offset, startMinute, endMinute);
        }
    }

    // A day off lands on the first workday with no working location on it, so nobody is
    // ever shown at the office and out of office at once.
    const claimsALocation = (name, offset) => recurringRows
        .some((row) => row.type === "workingLocation" && row.organizer === name && repeatCoversDay(row, offset));
    const daysOff = [
        { owner: alex, preferred: 21, description: "Unavailable for meetings." },
        { owner: jordan, preferred: 10, description: "Unavailable for the day." },
        { owner: taylor, preferred: 24, description: "Unavailable all day." },
        { owner: riley, preferred: 31, description: "Unavailable for the day." },
        { owner: casey, preferred: 16, description: "Unavailable for meetings." },
    ].map(({ owner, preferred, description }) => {
        const offset = workdayOffsets.filter((day) => day >= preferred).find((day) => !claimsALocation(owner.name, day));
        if (offset === undefined) throw new Error(`No clear out-of-office day for ${owner.name}.`);
        reserve(owner.name, offset, 0, 24 * 60);
        return { owner, offset, description };
    });

    // A repeating invitation on someone's day off is declined for that date only, which is
    // what a real calendar does when the invitee is away.
    for (const { owner, offset } of daysOff) {
        for (const row of recurringRows) {
            const isGuest = (row.participantIds || []).some((id) => String(id) === String(owner._id));
            if (!isGuest || !repeatCoversDay(row, offset)) continue;
            row.recurrenceResponseOverrides = [...(row.recurrenceResponseOverrides || []), {
                personId: owner._id,
                occurrenceStartAt: date(offset, 0, minutesOf(row.startAt)),
                scope: "this",
                status: "declined",
                respondedAt,
            }];
        }
    }

    const outOfOfficeRows = daysOff.map(({ owner, offset, description }) => event(owner, {
        title: "Out of office",
        type: "outOfOffice",
        description,
        startAt: date(offset, 0),
        endAt: date(offset + 1, 0),
        allDay: true,
    }));

    const milestoneRows = [
        event(alex, { calendar: "birthdays", title: "Jordan\u2019s birthday", description: "Birthday reminder.", startAt: date(3, 0), endAt: date(4, 0), allDay: true }),
        ...outOfOfficeRows,
        event(taylor, { title: "Out of office", type: "outOfOffice", description: "Unavailable after lunch.", startAt: date(4, 13), endAt: date(4, 18) }),
        event(alex, { title: "Office hours", type: "appointmentSchedule", description: "Open slots for project questions.", location: "Video call", startAt: date(6, 15), endAt: date(6, 17) }),
        event(jordan, { title: "Mentoring slots", type: "appointmentSchedule", description: "Book a 30-minute mentoring conversation.", startAt: date(12, 14), endAt: date(12, 16) }),
        event(taylor, { title: "Portfolio review slots", type: "appointmentSchedule", description: "Book a portfolio walkthrough.", startAt: date(18, 14), endAt: date(18, 16) }),
        event(riley, { title: "Technical office hours", type: "appointmentSchedule", description: "Open slots for architecture questions.", startAt: date(27, 15), endAt: date(27, 17) }),
        event(casey, { title: "Communications office hours", type: "appointmentSchedule", description: "Open slots for launch messaging.", startAt: date(9, 11), endAt: date(9, 13) }),
    ];
    reserve(taylor.name, 4, 13 * 60, 18 * 60);

    // Each rotation pick lands on the first half hour everyone involved is free and still working.
    const findSlot = (template, offset) => {
        const people = [template.owner.name, ...(template.guests || []).map((guest) => guest.name)];
        if (people.some((name) => isAway(name, offset))) return null;
        const windowStart = Math.max(...people.map((name) => hoursOf(name).startMinute));
        const windowEnd = Math.min(...people.map((name) => hoursOf(name).endMinute));
        const candidates = [template.hour * 60, ...Array.from({ length: 24 }, (unused, step) => windowStart + step * 30)];
        return candidates.find((startMinute) => startMinute >= windowStart
            && startMinute + template.minutes <= windowEnd
            && people.every((name) => isFree(name, offset, startMinute, startMinute + template.minutes))) ?? null;
    };

    const spreadRows = [];
    workdayOffsets.forEach((offset, dayIndex) => {
        const perDay = [3, 1, 2, 4, 2, 3, 1, 2][dayIndex % 8];
        for (let slot = 0; slot < perDay; slot += 1) {
            const template = spreadTemplates[(dayIndex * 3 + slot * 7) % spreadTemplates.length];
            const startMinute = findSlot(template, offset);
            if (startMinute === null) continue;
            const { owner, guests = [], statuses = [], hour, minutes, calendar, ...details } = template;
            const startAt = date(offset, 0, startMinute);
            for (const name of [owner.name, ...guests.map((guest) => guest.name)]) reserve(name, offset, startMinute, startMinute + minutes);
            spreadRows.push(event(owner, {
                ...details,
                ...(calendar ? { calendar } : {}),
                startAt,
                endAt: new Date(startAt.getTime() + minutes * 60000),
                ...(guests.length ? invited(guests, statuses) : {}),
            }));
        }
    });

    assertScheduleIsCoherent();

    return [...recurringRows, ...spreadRows, ...milestoneRows];

    // Runs on every seed, so a bad rotation fails here rather than reaching an interview.
    function assertScheduleIsCoherent() {
        const daysOffByName = new Map(daysOff.map(({ owner, offset }) => [owner.name, offset]));
        const fail = (reason) => { throw new Error(`Seed schedule is incoherent: ${reason}.`); };

        for (const [key, slots] of busy) {
            const timed = slots.filter((slot) => slot.endMinute - slot.startMinute < 24 * 60);
            for (let first = 0; first < timed.length; first += 1) {
                for (let second = first + 1; second < timed.length; second += 1) {
                    if (timed[first].startMinute >= timed[second].endMinute || timed[first].endMinute <= timed[second].startMinute) continue;
                    fail(`${key.replace("|", " is double booked on day ")}`);
                }
            }
        }

        for (const row of spreadRows) {
            const offset = offsetOfRow(row);
            const startMinute = minutesOf(row.startAt);
            const endMinute = startMinute + (row.endAt - row.startAt) / 60000;
            if (offset === null || isWeekend(offset)) fail(`"${row.title}" does not land on a workday`);
            for (const name of [row.organizer, ...(row.participants || [])]) {
                const hours = hoursOf(name);
                if (startMinute < hours.startMinute || endMinute > hours.endMinute) fail(`"${row.title}" falls outside ${name}'s working hours`);
                if (daysOffByName.get(name) === offset) fail(`${name} has "${row.title}" on their day off`);
            }
        }

        for (const [name, offset] of daysOffByName) {
            const locations = recurringRows.filter((row) => row.type === "workingLocation" && row.organizer === name && repeatCoversDay(row, offset));
            if (locations.length) fail(`${name} claims a working location on their day off`);
        }

        for (const offset of workdayOffsets) {
            for (const profile of profiles) {
                const locations = recurringRows.filter((row) => row.type === "workingLocation" && row.organizer === profile.name && repeatCoversDay(row, offset));
                if (locations.length > 1) fail(`${profile.name} claims ${locations.length} working locations on day ${offset}`);
            }
        }
    }

    function offsetOfRow(row) {
        const key = localDateKey(row.startAt, DEMO_TIME_ZONE);
        return workdayOffsets.find((offset) => dayKey(offset) === key) ?? null;
    }
}

function validateEventRows(rows, profiles, calendars) {
    const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]));
    const calendarOwnerById = new Map(calendars.map((calendar) => [String(calendar._id), String(calendar.ownerId)]));
    for (const row of rows) {
        const context = `${row.organizer}: ${row.title}`;
        if (!row.title?.trim()) throw new Error(`Seed event title is missing (${context}).`);
        if (!SUPPORTED_TYPES.has(row.type)) throw new Error(`Seed event type is invalid (${context}).`);
        if (!(row.startAt instanceof Date) || !(row.endAt instanceof Date) || row.endAt <= row.startAt) throw new Error(`Seed event range is invalid (${context}).`);
        const calendarOwner = profileById.get(calendarOwnerById.get(String(row.calendarId)));
        if (!calendarOwner || calendarOwner.name !== row.organizer) throw new Error(`Seed calendar ownership is inconsistent (${context}).`);
        if (row.allDay && [row.startAt, row.endAt].some((value) => { const at = partsAt(value, DEMO_TIME_ZONE); return at.hour || at.minute || at.second; })) throw new Error(`Seed all-day boundaries must sit at midnight in ${DEMO_TIME_ZONE} (${context}).`);
        const participantIds = (row.participantIds || []).map(String);
        if (new Set(participantIds).size !== participantIds.length || participantIds.includes(String(calendarOwner._id))) throw new Error(`Seed participants are duplicated or include the organizer (${context}).`);
        const expectedNames = participantIds.map((id) => profileById.get(id)?.name);
        if (expectedNames.some((name) => !name) || expectedNames.join("|") !== (row.participants || []).join("|")) throw new Error(`Seed participant names and identifiers disagree (${context}).`);
        const responseIds = (row.attendeeResponses || []).map((response) => String(response.personId));
        if (responseIds.join("|") !== participantIds.join("|")) throw new Error(`Seed RSVP rows do not match the invitation list (${context}).`);
        if (row.recurrence && (row.recurrence.count < 1 || row.recurrence.frequency === "none")) throw new Error(`Seed recurrence is invalid (${context}).`);
    }
}

async function seedEvents(profiles, calendars) {
    console.log("\nSeeding events...");
    const rows = buildEventRows(profiles, calendars.byKey);
    validateEventRows(rows, profiles, calendars.created);
    const created = await Event.create(rows);
    console.log(`  Created ${created.length} events between ${dayKey(SPREAD_FIRST_DAY)} and ${dayKey(SPREAD_LAST_DAY)}`);
    return created;
}

async function seed() {
    try {
        console.log("========================================");
        console.log("Database Seeding");
        console.log("========================================\n");

        console.log("Connecting to MongoDB...");
        await mongoose.connect(config.mongodbUri);
        console.log("Connected to MongoDB");

        await clearDatabase();

        const profiles = await seedProfiles();
        await seedAccounts(profiles);
        const calendars = await seedCalendars(profiles);
        await seedEvents(profiles, calendars);

        const counts = await Promise.all([
            Person.countDocuments(),
            WorkspaceAccount.countDocuments(),
            Calendar.countDocuments(),
            Event.countDocuments(),
        ]);

        console.log("\n========================================");
        console.log("Seeding completed successfully!");
        console.log("========================================");
        console.log("\nCollection counts:");
        console.log(`  Profiles:  ${counts[0]}`);
        console.log(`  Accounts:  ${counts[1]}`);
        console.log(`  Calendars: ${counts[2]}`);
        console.log(`  Events:    ${counts[3]}`);
        console.log("\nTest Users:");
        for (const profile of profiles) console.log(`  Email: ${profile.email} | Password: ${DEMO_PASSWORD}`);
        console.log(`\nAll times are seeded in ${DEMO_TIME_ZONE}, relative to ${todayKey}.`);
        console.log("========================================\n");
    } catch (error) {
        console.error("\nSeeding failed:", error.message);
        console.error(error.stack);
        process.exit(1);
    } finally {
        await mongoose.disconnect();
        console.log("Disconnected from MongoDB");
    }
}

seed();
