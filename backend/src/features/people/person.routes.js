import { Router } from "express";
import { listProfiles, searchPeople } from "./person.controller.js";

export const personRouter = Router();
personRouter.get("/", searchPeople);
export const profileRouter = Router();
profileRouter.get("/", listProfiles);
