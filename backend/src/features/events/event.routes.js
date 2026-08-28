import { Router } from "express";
import { createEvent, deleteEvent, getEvent, listEvents, respondToEvent, searchEvents, updateEvent } from "./event.controller.js";

export const eventRouter = Router();
eventRouter.get("/", listEvents);
eventRouter.get("/search", searchEvents);
eventRouter.get("/:eventId", getEvent);
eventRouter.post("/", createEvent);
eventRouter.patch("/:eventId/response", respondToEvent);
eventRouter.patch("/:eventId", updateEvent);
eventRouter.delete("/:eventId", deleteEvent);
