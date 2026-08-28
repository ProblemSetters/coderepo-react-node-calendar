export const demoProfileColors = {
    "river@hackerrank.com": { profile: "#1a73e8", work: "#0b8043", Birthdays: "#c5221f" },
    "sky@hackerrank.com": { profile: "#b85c00", work: "#3f51b5" },
    "sage@hackerrank.com": { profile: "#c2185b", work: "#00796b" },
    "ember@hackerrank.com": { profile: "#00796b", work: "#795548" },
    "nova@hackerrank.com": { profile: "#7b1fa2", work: "#b85c00" },
};

export const demoColorFor = (email, calendar = "profile") => demoProfileColors[email]?.[calendar] || demoProfileColors[email]?.profile || "#5f6368";
