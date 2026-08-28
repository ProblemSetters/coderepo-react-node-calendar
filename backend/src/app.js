import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { availabilityRouter } from "./features/availability/availability.routes.js";
import { calendarRouter } from "./features/calendars/calendar.routes.js";
import { eventRouter } from "./features/events/event.routes.js";
import { insightRouter } from "./features/insights/insight.routes.js";
import { personRouter, profileRouter } from "./features/people/person.routes.js";
import { authRouter } from "./features/auth/auth.routes.js";
import { config } from "./shared/config/index.js";
import { errorHandler, notFoundHandler } from "./shared/middleware/error-handler.js";
import { resolveProfileContext } from "./shared/middleware/profile-context.js";
import { requireWorkspaceAuth } from "./shared/middleware/auth.js";

export function createApp() {
    const app = express();
    app.disable("x-powered-by");
    app.use(cors({ origin: config.clientOrigins }));
    app.use(express.json({ limit: "100kb" }));
    app.get("/api/v1/health", (request, response) => {
        const database = mongoose.connection.readyState === 1 ? "connected" : "disconnected";
        response.status(database === "connected" ? 200 : 503).json({ data: { status: database === "connected" ? "ok" : "degraded", database } });
    });
    app.use("/api/v1/auth", authRouter);
    app.use("/api/v1/profiles", requireWorkspaceAuth, profileRouter);
    app.use("/api/v1", requireWorkspaceAuth, resolveProfileContext);
    app.use("/api/v1/calendars", calendarRouter);
    app.use("/api/v1/events", eventRouter);
    app.use("/api/v1/insights", insightRouter);
    app.use("/api/v1/people", personRouter);
    app.use("/api/v1/availability", availabilityRouter);
    app.use(notFoundHandler);
    app.use(errorHandler);
    return app;
}
