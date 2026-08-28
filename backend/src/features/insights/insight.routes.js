import { Router } from "express";
import { getDailyInsight } from "./insight.controller.js";

export const insightRouter = Router();
insightRouter.get("/daily", getDailyInsight);
