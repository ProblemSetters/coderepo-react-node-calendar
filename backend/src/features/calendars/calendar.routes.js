import { Router } from "express";
import { createCalendar, deleteCalendar, displayOnlyCalendar, listCalendars, updateCalendar } from "./calendar.controller.js";

export const calendarRouter = Router();
calendarRouter.get("/", listCalendars);
calendarRouter.post("/", createCalendar);
calendarRouter.post("/:calendarId/display-only", displayOnlyCalendar);
calendarRouter.patch("/:calendarId", updateCalendar);
calendarRouter.delete("/:calendarId", deleteCalendar);
