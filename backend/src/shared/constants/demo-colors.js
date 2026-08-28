export const demoProfileColors = {
    "mahadevan@example.com": { profile: "#1a73e8", work: "#0b8043", Birthdays: "#c5221f" },
    "aarav.mehta@example.com": { profile: "#b85c00", work: "#3f51b5" },
    "diya.shah@example.com": { profile: "#c2185b", work: "#00796b" },
    "kabir.iyer@example.com": { profile: "#00796b", work: "#795548" },
    "meera.nair@example.com": { profile: "#7b1fa2", work: "#b85c00" },
};

export const demoColorFor = (email, calendar = "profile") => demoProfileColors[email]?.[calendar] || demoProfileColors[email]?.profile || "#5f6368";
