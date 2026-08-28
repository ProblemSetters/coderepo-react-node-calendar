import dotenv from "dotenv";

dotenv.config({ quiet: true });

const production = process.env.NODE_ENV === "production";
if (production && !process.env.JWT_SECRET) throw new Error("JWT_SECRET is required in production.");

export const config = {
    clientOrigins: [...new Set([
        ...(process.env.CLIENT_ORIGIN || "http://localhost:3000").split(",").map((origin) => origin.trim()).filter(Boolean),
        ...(process.env.NODE_ENV === "production" ? [] : ["http://localhost:3000"]),
    ])],
    mongoUri: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/calendar_db",
    port: Number(process.env.PORT || 8000),
    jwtSecret: process.env.JWT_SECRET || "calendar-local-development-secret",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "8h",
};
