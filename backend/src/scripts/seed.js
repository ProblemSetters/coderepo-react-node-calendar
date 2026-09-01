import bcrypt from "bcryptjs";
import { Calendar } from "../features/calendars/calendar.model.js";
import { Event } from "../features/events/event.model.js";
import { Person } from "../features/people/person.model.js";
import { WorkspaceAccount } from "../features/auth/workspace-account.model.js";
import dotenv from "dotenv";
import { connectDatabase, disconnectDatabase } from "../shared/config/database.js";
import { initConfig } from "../shared/config/index.js";
import { demoColorFor } from "../shared/constants/demo-colors.js";
import { addCalendarDays, dayOfWeek, localDateKey, partsAt, zonedDateTime } from "../shared/utils/time-zone.js";

const DEMO_TIME_ZONE = "UTC";
const WORKSPACE_EMAIL = "workspace@calendar.com";
const WORKSPACE_PASSWORD = "password123";
const PASSWORD_ROUNDS = 12;
const SPREAD_FIRST_DAY = -45;
const SPREAD_LAST_DAY = 60;

const todayKey = localDateKey(new Date(), DEMO_TIME_ZONE);
const dayKey = (dayOffset) => addCalendarDays(todayKey, dayOffset);
const date = (dayOffset, hour, minute = 0) => zonedDateTime(dayKey(dayOffset), hour * 60 + minute, DEMO_TIME_ZONE);
const isWeekend = (dayOffset) => [0, 6].includes(dayOfWeek(dayKey(dayOffset)));

dotenv.config({ quiet: true });
await connectDatabase(initConfig().mongodbUri);
await Promise.all([Event.deleteMany({}), Calendar.deleteMany({}), Person.deleteMany({}), WorkspaceAccount.deleteMany({})]);
await Promise.all([Calendar.syncIndexes(), Person.syncIndexes(), Event.syncIndexes(), WorkspaceAccount.syncIndexes()]);

const profiles = await Person.create([
    { name: "Alex Morgan", email: "alex.morgan@calendar.com", avatarColor: demoColorFor("alex.morgan@calendar.com"), isProfile: true, sortOrder: 1, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 540, endMinute: 1050 } },
    { name: "Jordan Smith", email: "jordan.smith@calendar.com", avatarColor: demoColorFor("jordan.smith@calendar.com"), isProfile: true, sortOrder: 2, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 540, endMinute: 1020 } },
    { name: "Taylor Johnson", email: "taylor.johnson@calendar.com", avatarColor: demoColorFor("taylor.johnson@calendar.com"), isProfile: true, sortOrder: 3, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 600, endMinute: 1080 } },
    { name: "Riley Parker", email: "riley.parker@calendar.com", avatarColor: demoColorFor("riley.parker@calendar.com"), isProfile: true, sortOrder: 4, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 480, endMinute: 990 } },
    { name: "Casey Bennett", email: "casey.bennett@calendar.com", avatarColor: demoColorFor("casey.bennett@calendar.com"), isProfile: true, sortOrder: 5, timeZone: DEMO_TIME_ZONE, workingHours: { startMinute: 540, endMinute: 1020 } },
]);
const [alex, jordan, taylor, riley, casey] = profiles;

await WorkspaceAccount.create({
    name: "Shared workspace",
    email: WORKSPACE_EMAIL,
    passwordHash: await bcrypt.hash(WORKSPACE_PASSWORD, PASSWORD_ROUNDS),
    allowedProfileIds: profiles.map((profile) => profile._id),
});

const calendarRows = profiles.flatMap((profile) => [
    { ownerId: profile._id, key: `${profile.email}:primary`, name: "My calendar", color: profile.avatarColor, visible: true, isPrimary: true },
    { ownerId: profile._id, key: `${profile.email}:work`, name: "Work", color: demoColorFor(profile.email, "work"), visible: true, isPrimary: false },
]);
calendarRows.push({ ownerId: alex._id, key: `${alex.email}:birthdays`, name: "Birthdays", color: demoColorFor(alex.email, "Birthdays"), visible: true, isPrimary: false });
const createdCalendars = await Calendar.create(calendarRows.map(({ key, ...calendar }) => ({ ...calendar, defaultColor: calendar.color })));
const calendars = new Map(calendarRows.map((calendar, index) => [calendar.key, createdCalendars[index]]));
const calendarFor = (profile, name = "primary") => calendars.get(`${profile.email}:${name}`);

const respondedAt = date(-2, 12);
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
    event(alex, { calendar: "work", title: "Weekly product planning", description: "Review priorities, risks, and the next delivery window.", location: "Conference room Maple", startAt: date(-7, 9), endAt: date(-7, 10), recurrence: recurrence("weekly"), ...invited([jordan, taylor, riley], ["accepted", "accepted", "tentative"]) }),
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

const spreadRows = workdayOffsets.flatMap((offset, dayIndex) => {
    const perDay = [3, 1, 2, 4, 2, 3, 1, 2][dayIndex % 8];
    return Array.from({ length: perDay }, (_, slot) => {
        const template = spreadTemplates[(dayIndex * 3 + slot * 7) % spreadTemplates.length];
        const { owner, guests = [], statuses = [], hour, minutes, calendar, ...details } = template;
        const startAt = date(offset, hour + slot);
        return event(owner, {
            ...details,
            ...(calendar ? { calendar } : {}),
            startAt,
            endAt: new Date(startAt.getTime() + minutes * 60000),
            ...(guests.length ? invited(guests, statuses) : {}),
        });
    });
});

const milestoneRows = [
    event(alex, { calendar: "birthdays", title: "Jordan’s birthday", description: "Birthday reminder.", startAt: date(3, 0), endAt: date(4, 0), allDay: true }),
    event(alex, { title: "Out of office", type: "outOfOffice", description: "Unavailable for meetings.", startAt: date(21, 0), endAt: date(23, 0), allDay: true }),
    event(jordan, { title: "Out of office", type: "outOfOffice", description: "Unavailable for the day.", startAt: date(10, 0), endAt: date(11, 0), allDay: true }),
    event(taylor, { title: "Out of office", type: "outOfOffice", description: "Unavailable after lunch.", startAt: date(4, 13), endAt: date(4, 18) }),
    event(riley, { title: "Out of office", type: "outOfOffice", startAt: date(-12, 0), endAt: date(-10, 0), allDay: true }),
    event(alex, { title: "Office hours", type: "appointmentSchedule", description: "Open slots for project questions.", location: "Video call", startAt: date(6, 15), endAt: date(6, 17) }),
    event(jordan, { title: "Mentoring slots", type: "appointmentSchedule", description: "Book a 30-minute mentoring conversation.", startAt: date(12, 14), endAt: date(12, 16) }),
    event(taylor, { title: "Portfolio review slots", type: "appointmentSchedule", startAt: date(18, 14), endAt: date(18, 16) }),
    event(riley, { title: "Technical office hours", type: "appointmentSchedule", startAt: date(27, 15), endAt: date(27, 17) }),
    event(casey, { title: "Communications office hours", type: "appointmentSchedule", startAt: date(-15, 11), endAt: date(-15, 13) }),
];

const eventRows = [...recurringRows, ...spreadRows, ...milestoneRows];

const profileById = new Map(profiles.map((profile) => [String(profile._id), profile]));
const calendarOwnerById = new Map(createdCalendars.map((calendar) => [String(calendar._id), String(calendar.ownerId)]));
const supportedTypes = new Set(["event", "task", "outOfOffice", "focusTime", "workingLocation", "appointmentSchedule"]);
for (const row of eventRows) {
    const context = `${row.organizer}: ${row.title}`;
    if (!row.title?.trim()) throw new Error(`Seed event title is missing (${context}).`);
    if (!supportedTypes.has(row.type)) throw new Error(`Seed event type is invalid (${context}).`);
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

await Event.create(eventRows);

await disconnectDatabase();
