import { Router } from "express";
import { checkConflicts, suggestTimes } from "./availability.controller.js";

export const availabilityRouter = Router();
availabilityRouter.post("/suggestions", suggestTimes);
availabilityRouter.post("/conflicts", checkConflicts);
