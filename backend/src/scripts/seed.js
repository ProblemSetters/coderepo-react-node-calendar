import { Calendar } from "../features/calendars/calendar.model.js";
import { Event } from "../features/events/event.model.js";
import { Person } from "../features/people/person.model.js";
import { connectDatabase, disconnectDatabase } from "../shared/config/database.js";
import { demoColorFor } from "../shared/constants/demo-colors.js";

const today = new Date();
today.setHours(0, 0, 0, 0);
const date = (dayOffset, hour, minute = 0) => {
    const value = new Date(today);
    value.setDate(value.getDate() + dayOffset);
    value.setHours(hour, minute, 0, 0);
    return value;
};

await connectDatabase();
await Promise.all([Event.deleteMany({}), Calendar.deleteMany({}), Person.deleteMany({})]);
await Promise.all([Calendar.syncIndexes(), Person.syncIndexes(), Event.syncIndexes()]);

const profiles = await Person.create([
    { name: "Mahadevan M", email: "mahadevan@example.com", avatarColor: demoColorFor("mahadevan@example.com"), isProfile: true, headline: "Product & engineering", sortOrder: 1, workingHours: { startMinute: 540, endMinute: 1050 } },
    { name: "Aarav Mehta", email: "aarav.mehta@example.com", avatarColor: demoColorFor("aarav.mehta@example.com"), isProfile: true, headline: "Frontend engineering", sortOrder: 2, workingHours: { startMinute: 540, endMinute: 1020 } },
    { name: "Diya Shah", email: "diya.shah@example.com", avatarColor: demoColorFor("diya.shah@example.com"), isProfile: true, headline: "Product design", sortOrder: 3, workingHours: { startMinute: 600, endMinute: 1080 } },
    { name: "Kabir Iyer", email: "kabir.iyer@example.com", avatarColor: demoColorFor("kabir.iyer@example.com"), isProfile: true, headline: "Platform engineering", sortOrder: 4, workingHours: { startMinute: 480, endMinute: 990 } },
    { name: "Meera Nair", email: "meera.nair@example.com", avatarColor: demoColorFor("meera.nair@example.com"), isProfile: true, headline: "Growth marketing", sortOrder: 5, workingHours: { startMinute: 540, endMinute: 1020 } },
]);
const [mahadevan, aarav, diya, kabir, meera] = profiles;

const calendarRows = profiles.flatMap((profile) => [
    { ownerId: profile._id, key: `${profile.email}:primary`, name: "My calendar", color: profile.avatarColor, visible: true, isPrimary: true },
    { ownerId: profile._id, key: `${profile.email}:work`, name: "Work", color: demoColorFor(profile.email, "work"), visible: true, isPrimary: false },
]);
calendarRows.push({ ownerId: mahadevan._id, key: `${mahadevan.email}:birthdays`, name: "Birthdays", color: demoColorFor(mahadevan.email, "Birthdays"), visible: true, isPrimary: false });
const createdCalendars = await Calendar.create(calendarRows.map(({ key, ...calendar }) => ({ ...calendar, defaultColor: calendar.color })));
const calendars = new Map(calendarRows.map((calendar, index) => [calendar.key, createdCalendars[index]]));
const calendarFor = (profile, name = "primary") => calendars.get(`${profile.email}:${name}`);

await Event.create([
    { calendarId: calendarFor(mahadevan)._id, title: "Office", type: "workingLocation", description: "Working from the office.", location: "Office", organizer: mahadevan.name, startAt: date(0, 0), endAt: date(1, 0), allDay: true },
    { calendarId: calendarFor(mahadevan, "work")._id, title: "Design review", description: "Review the weekly product plan.", location: "Conference room Cedar", organizer: mahadevan.name, participants: [diya.name], participantIds: [diya._id], startAt: date(0, 10), endAt: date(0, 11) },
    { calendarId: calendarFor(mahadevan)._id, title: "Focus time", type: "focusTime", description: "Protected time for deep work.", organizer: mahadevan.name, startAt: date(0, 14), endAt: date(0, 15, 30) },
    { calendarId: calendarFor(mahadevan, "work")._id, title: "Team roadmap", description: "Align priorities for the next milestone.", location: "Orchid", organizer: mahadevan.name, participants: [aarav.name, diya.name], participantIds: [aarav._id, diya._id], startAt: date(1, 11), endAt: date(1, 12) },
    { calendarId: calendarFor(mahadevan)._id, title: "Dentist appointment", organizer: mahadevan.name, location: "Lakeview Dental", startAt: date(2, 16), endAt: date(2, 17) },
    { calendarId: calendarFor(mahadevan, "birthdays")._id, title: "Avery's birthday", organizer: mahadevan.name, startAt: date(3, 0), endAt: date(4, 0), allDay: true },
    { calendarId: calendarFor(aarav, "work")._id, title: "Project sync", organizer: aarav.name, participants: [kabir.name], participantIds: [kabir._id], startAt: date(0, 9, 30), endAt: date(0, 10, 30) },
    { calendarId: calendarFor(aarav)._id, title: "Customer call", organizer: aarav.name, startAt: date(0, 13), endAt: date(0, 14) },
    { calendarId: calendarFor(aarav)._id, title: "Code review", type: "focusTime", organizer: aarav.name, startAt: date(1, 15), endAt: date(1, 16, 30) },
    { calendarId: calendarFor(diya, "work")._id, title: "Team stand-up", organizer: diya.name, startAt: date(0, 10, 30), endAt: date(0, 11) },
    { calendarId: calendarFor(diya)._id, title: "Design critique", organizer: diya.name, participants: [meera.name], participantIds: [meera._id], startAt: date(0, 15), endAt: date(0, 16) },
    { calendarId: calendarFor(diya)._id, title: "Research review", organizer: diya.name, startAt: date(2, 14), endAt: date(2, 15) },
    { calendarId: calendarFor(kabir, "work")._id, title: "Engineering review", organizer: kabir.name, startAt: date(0, 11), endAt: date(0, 12) },
    { calendarId: calendarFor(kabir)._id, title: "One-on-one", organizer: kabir.name, startAt: date(1, 14), endAt: date(1, 14, 30) },
    { calendarId: calendarFor(meera, "work")._id, title: "Campaign planning", organizer: meera.name, startAt: date(0, 12), endAt: date(0, 13) },
    { calendarId: calendarFor(meera)._id, title: "Agency call", organizer: meera.name, startAt: date(0, 16), endAt: date(0, 17) },
]);

await disconnectDatabase();
