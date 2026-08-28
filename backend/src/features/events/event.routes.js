import { Router } from "express";
import { createEvent, deleteEvent, getEvent, listEvents, searchEvents, updateEvent } from "./event.controller.js";

export const eventRouter = Router();
eventRouter.get("/", listEvents);
eventRouter.get("/search", searchEvents);
eventRouter.get("/:eventId", getEvent);
eventRouter.post("/", createEvent);
eventRouter.patch("/:eventId", updateEvent);
eventRouter.delete("/:eventId", deleteEvent);
