import { Calendar } from "../features/calendars/calendar.model.js";
import { Event } from "../features/events/event.model.js";
import { Person } from "../features/people/person.model.js";
import { WorkspaceAccount } from "../features/auth/workspace-account.model.js";
import { connectDatabase, disconnectDatabase } from "../shared/config/database.js";
import { demoColorFor } from "../shared/constants/demo-colors.js";
import bcrypt from "bcryptjs";

const today = new Date();
today.setHours(0, 0, 0, 0);
const date = (dayOffset, hour, minute = 0) => {
    const value = new Date(today);
    value.setDate(value.getDate() + dayOffset);
    value.setHours(hour, minute, 0, 0);
    return value;
};

await connectDatabase();
await Promise.all([Event.deleteMany({}), Calendar.deleteMany({}), Person.deleteMany({}), WorkspaceAccount.deleteMany({})]);
await Promise.all([Calendar.syncIndexes(), Person.syncIndexes(), Event.syncIndexes(), WorkspaceAccount.syncIndexes()]);

const profiles = await Person.create([
    { name: "River", email: "river@hackerrank.com", avatarColor: demoColorFor("river@hackerrank.com"), isProfile: true, sortOrder: 1, timeZone: "Asia/Kolkata", workingHours: { startMinute: 540, endMinute: 1050 } },
    { name: "Sky", email: "sky@hackerrank.com", avatarColor: demoColorFor("sky@hackerrank.com"), isProfile: true, sortOrder: 2, timeZone: "Asia/Kolkata", workingHours: { startMinute: 540, endMinute: 1020 } },
    { name: "Sage", email: "sage@hackerrank.com", avatarColor: demoColorFor("sage@hackerrank.com"), isProfile: true, sortOrder: 3, timeZone: "Asia/Kolkata", workingHours: { startMinute: 600, endMinute: 1080 } },
    { name: "Ember", email: "ember@hackerrank.com", avatarColor: demoColorFor("ember@hackerrank.com"), isProfile: true, sortOrder: 4, timeZone: "Asia/Kolkata", workingHours: { startMinute: 480, endMinute: 990 } },
    { name: "Nova", email: "nova@hackerrank.com", avatarColor: demoColorFor("nova@hackerrank.com"), isProfile: true, sortOrder: 5, timeZone: "Asia/Kolkata", workingHours: { startMinute: 540, endMinute: 1020 } },
]);
const [river, sky, sage, ember, nova] = profiles;
await WorkspaceAccount.create({
    name: "Calendar assessment",
    email: process.env.DEMO_ACCOUNT_EMAIL || "calendar@hackerrank.com",
    passwordHash: await bcrypt.hash(process.env.DEMO_ACCOUNT_PASSWORD || "password123", 12),
    allowedProfileIds: profiles.map((profile) => profile._id),
});

const calendarRows = profiles.flatMap((profile) => [
    { ownerId: profile._id, key: `${profile.email}:primary`, name: "My calendar", color: profile.avatarColor, visible: true, isPrimary: true },
    { ownerId: profile._id, key: `${profile.email}:work`, name: "Work", color: demoColorFor(profile.email, "work"), visible: true, isPrimary: false },
]);
calendarRows.push({ ownerId: river._id, key: `${river.email}:birthdays`, name: "Birthdays", color: demoColorFor(river.email, "Birthdays"), visible: true, isPrimary: false });
const createdCalendars = await Calendar.create(calendarRows.map(({ key, ...calendar }) => ({ ...calendar, defaultColor: calendar.color })));
const calendars = new Map(calendarRows.map((calendar, index) => [calendar.key, createdCalendars[index]]));
const calendarFor = (profile, name = "primary") => calendars.get(`${profile.email}:${name}`);

const acceptedAt = date(-2, 12);
const recurrence = (frequency, options = {}) => ({ frequency, interval: 1, endType: "count", count: 20, timeZone: "Asia/Kolkata", ...options });
const invited = (people, statuses = []) => ({
    participants: people.map((person) => person.name),
    participantIds: people.map((person) => person._id),
    attendeeResponses: people.map((person, index) => ({
        personId: person._id,
        status: statuses[index] || "needsAction",
        respondedAt: statuses[index] && statuses[index] !== "needsAction" ? acceptedAt : null,
    })),
});
const event = (owner, values) => {
    const { calendar = "primary", ...details } = values;
    return {
        calendarId: calendarFor(owner, calendar)._id,
        organizer: owner.name,
        type: "event",
        description: "",
        location: "",
        ...details,
    };
};

const eventRows = [
    event(river, { title: "Office", type: "workingLocation", description: "Working from the office today.", location: "Office", startAt: date(-10, 0), endAt: date(-9, 0), allDay: true, recurrence: recurrence("weekdays", { count: 35 }) }),
    event(river, { calendar: "work", title: "Design review", description: "Review the current product flow and resolve open decisions.", location: "Conference room Cedar", startAt: date(0, 10), endAt: date(0, 11), ...invited([sage, nova], ["accepted", "tentative"]) }),
    event(river, { title: "Lunch break", description: "Protected lunch break.", startAt: date(0, 12, 30), endAt: date(0, 13) }),
    event(river, { title: "Focus time", type: "focusTime", description: "Protected time for the release-readiness write-up.", startAt: date(0, 14), endAt: date(0, 15, 30) }),
    event(river, { title: "Publish weekly update", type: "task", description: "Summarize decisions, owners, and next steps.", startAt: date(0, 16), endAt: date(0, 16, 30) }),
    event(river, { calendar: "work", title: "Team roadmap", description: "Align priorities for the next milestone.", location: "Orchid", startAt: date(1, 11), endAt: date(1, 12), ...invited([sky, sage], ["accepted", "needsAction"]) }),
    event(river, { title: "Health appointment", description: "Annual preventive check-up.", location: "Community clinic", startAt: date(2, 16), endAt: date(2, 17) }),
    event(river, { calendar: "birthdays", title: "Sky’s birthday", description: "Birthday reminder.", startAt: date(3, 0), endAt: date(4, 0), allDay: true }),
    event(river, { calendar: "work", title: "Weekly product planning", description: "Review priorities, risks, and the next delivery window.", location: "Conference room Maple", startAt: date(-7, 9), endAt: date(-7, 10), recurrence: recurrence("weekly", { count: 12 }), ...invited([sky, sage, ember], ["accepted", "accepted", "tentative"]) }),
    event(river, { calendar: "work", title: "Metrics review", description: "Review adoption, reliability, and user feedback.", startAt: date(-3, 15), endAt: date(-3, 15, 45), recurrence: recurrence("weekly", { count: 10 }), ...invited([nova], ["accepted"]) }),
    event(river, { title: "Out of office", type: "outOfOffice", description: "Unavailable for meetings.", startAt: date(6, 0), endAt: date(8, 0), allDay: true }),
    event(river, { title: "Office hours", type: "appointmentSchedule", description: "Open slots for project questions.", location: "Video call", startAt: date(4, 15), endAt: date(4, 17) }),
    event(river, { title: "Read research notes", type: "task", startAt: date(-1, 18), endAt: date(-1, 18, 30) }),

    event(sky, { title: "Home", type: "workingLocation", description: "Working remotely.", location: "Home", startAt: date(-9, 0), endAt: date(-8, 0), allDay: true, recurrence: recurrence("weekly", { daysOfWeek: [1, 3], count: 18 }) }),
    event(sky, { calendar: "work", title: "Project sync", description: "Review delivery status and clear blockers.", location: "Conference room Birch", startAt: date(0, 9, 30), endAt: date(0, 10, 30), ...invited([ember], ["accepted"]) }),
    event(sky, { title: "Customer discovery", description: "Understand the current scheduling workflow.", location: "Video call", startAt: date(0, 13), endAt: date(0, 14), ...invited([nova], ["accepted"]) }),
    event(sky, { title: "Code review", type: "focusTime", description: "Review the authentication and recurrence changes.", startAt: date(1, 15), endAt: date(1, 16, 30) }),
    event(sky, { calendar: "work", title: "Delivery stand-up", description: "Daily progress and blockers.", startAt: date(-8, 9, 15), endAt: date(-8, 9, 30), recurrence: recurrence("weekdays", { count: 35 }), ...invited([ember], ["accepted"]) }),
    event(sky, { calendar: "work", title: "Partner update", description: "Share progress and confirm next actions.", startAt: date(2, 11, 30), endAt: date(2, 12, 15), ...invited([river], ["needsAction"]) }),
    event(sky, { title: "Prepare demo workspace", type: "task", startAt: date(2, 14), endAt: date(2, 14, 30) }),
    event(sky, { title: "Deep work", type: "focusTime", startAt: date(3, 10), endAt: date(3, 12) }),
    event(sky, { title: "Out of office", type: "outOfOffice", description: "Unavailable for the day.", startAt: date(10, 0), endAt: date(11, 0), allDay: true }),
    event(sky, { title: "Mentoring slots", type: "appointmentSchedule", description: "Book a 30-minute mentoring conversation.", startAt: date(5, 14), endAt: date(5, 16) }),

    event(sage, { title: "Office", type: "workingLocation", location: "Office", startAt: date(-10, 0), endAt: date(-9, 0), allDay: true, recurrence: recurrence("weekdays", { count: 35 }) }),
    event(sage, { calendar: "work", title: "Team stand-up", description: "Share progress and unblock the team.", startAt: date(-9, 10, 30), endAt: date(-9, 11), recurrence: recurrence("weekdays", { count: 35 }), ...invited([nova], ["accepted"]) }),
    event(sage, { title: "Design critique", description: "Review the responsive Month and Week experiences.", location: "Studio", startAt: date(0, 15), endAt: date(0, 16), ...invited([nova], ["needsAction"]) }),
    event(sage, { title: "Research review", description: "Synthesize usability-study findings.", startAt: date(2, 14), endAt: date(2, 15), ...invited([river], ["accepted"]) }),
    event(sage, { title: "Prototype exploration", type: "focusTime", startAt: date(1, 13), endAt: date(1, 15) }),
    event(sage, { calendar: "work", title: "Content workshop", description: "Improve empty, loading, and error-state language.", location: "Conference room Elm", startAt: date(3, 11), endAt: date(3, 12, 30), ...invited([river, sky], ["accepted", "declined"]) }),
    event(sage, { title: "Update accessibility notes", type: "task", startAt: date(3, 16), endAt: date(3, 16, 30) }),
    event(sage, { title: "Out of office", type: "outOfOffice", description: "Unavailable after lunch.", startAt: date(4, 13), endAt: date(4, 18) }),
    event(sage, { title: "Portfolio review slots", type: "appointmentSchedule", startAt: date(7, 14), endAt: date(7, 16) }),

    event(ember, { title: "Office", type: "workingLocation", location: "Office", startAt: date(-10, 0), endAt: date(-9, 0), allDay: true, recurrence: recurrence("weekly", { daysOfWeek: [2, 4], count: 18 }) }),
    event(ember, { calendar: "work", title: "Engineering review", description: "Review architecture, reliability, and rollout risks.", location: "Conference room Pine", startAt: date(0, 11), endAt: date(0, 12), ...invited([sky, river], ["accepted", "tentative"]) }),
    event(ember, { title: "One-on-one", description: "Weekly coaching conversation.", startAt: date(1, 14), endAt: date(1, 14, 30), recurrence: recurrence("weekly", { count: 10 }), ...invited([sky], ["accepted"]) }),
    event(ember, { calendar: "work", title: "Release readiness", description: "Verify tests, monitoring, and rollback steps.", startAt: date(2, 10), endAt: date(2, 11), ...invited([river, sky, sage], ["accepted", "accepted", "needsAction"]) }),
    event(ember, { title: "Incident drill", description: "Practice the service-recovery playbook.", location: "Operations room", startAt: date(3, 15), endAt: date(3, 16) }),
    event(ember, { title: "Architecture notes", type: "focusTime", startAt: date(0, 14), endAt: date(0, 16) }),
    event(ember, { title: "Rotate service credentials", type: "task", startAt: date(4, 11), endAt: date(4, 11, 30) }),
    event(ember, { title: "Out of office", type: "outOfOffice", startAt: date(12, 0), endAt: date(14, 0), allDay: true }),
    event(ember, { title: "Technical office hours", type: "appointmentSchedule", startAt: date(6, 15), endAt: date(6, 17) }),

    event(nova, { title: "Home", type: "workingLocation", location: "Home", startAt: date(-10, 0), endAt: date(-9, 0), allDay: true, recurrence: recurrence("weekdays", { count: 35 }) }),
    event(nova, { calendar: "work", title: "Campaign planning", description: "Coordinate launch messages and channel owners.", location: "Conference room Willow", startAt: date(0, 12), endAt: date(0, 13), ...invited([river, sage], ["accepted", "accepted"]) }),
    event(nova, { title: "Agency call", description: "Review the next creative delivery.", location: "Video call", startAt: date(0, 16), endAt: date(0, 17) }),
    event(nova, { calendar: "work", title: "Launch check-in", description: "Confirm launch dependencies and owners.", startAt: date(-8, 11), endAt: date(-8, 11, 30), recurrence: recurrence("weekly", { count: 12 }), ...invited([river, sky], ["accepted", "accepted"]) }),
    event(nova, { title: "Write launch brief", type: "focusTime", startAt: date(1, 10), endAt: date(1, 12) }),
    event(nova, { title: "Editorial review", description: "Final review of the release announcement.", startAt: date(2, 15), endAt: date(2, 16), ...invited([sage], ["tentative"]) }),
    event(nova, { title: "Schedule release posts", type: "task", startAt: date(3, 13), endAt: date(3, 13, 30) }),
    event(nova, { title: "Out of office", type: "outOfOffice", description: "Unavailable for meetings.", startAt: date(8, 0), endAt: date(9, 0), allDay: true }),
    event(nova, { title: "Communications office hours", type: "appointmentSchedule", startAt: date(5, 11), endAt: date(5, 13) }),
];

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
    if (row.allDay && [row.startAt, row.endAt].some((value) => value.getHours() || value.getMinutes() || value.getSeconds())) throw new Error(`Seed all-day boundaries must use local midnight (${context}).`);
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
