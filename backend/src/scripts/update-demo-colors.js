import { Calendar } from "../features/calendars/calendar.model.js";
import { Person } from "../features/people/person.model.js";
import { connectDatabase, disconnectDatabase } from "../shared/config/database.js";
import { demoProfileColors } from "../shared/constants/demo-colors.js";

await connectDatabase();
let profilesUpdated = 0;
let calendarsUpdated = 0;

for (const [email, colors] of Object.entries(demoProfileColors)) {
    const profile = await Person.findOneAndUpdate({ email }, { avatarColor: colors.profile }, { new: true });
    if (!profile) continue;
    profilesUpdated += 1;
    const assignments = { "My calendar": colors.profile, Work: colors.work, ...(colors.Birthdays ? { Birthdays: colors.Birthdays } : {}) };
    for (const [name, color] of Object.entries(assignments)) {
        const result = await Calendar.updateOne({ ownerId: profile._id, name }, { color, defaultColor: color });
        calendarsUpdated += result.modifiedCount;
    }
}

console.log(`Updated ${profilesUpdated} demo profiles and ${calendarsUpdated} calendars.`);
await disconnectDatabase();
