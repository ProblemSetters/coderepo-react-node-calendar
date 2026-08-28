import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { AppError } from "../../shared/errors/app-error.js";
import { config } from "../../shared/config/index.js";
import { personService } from "../people/person.service.js";
import { authRepository } from "./auth.repository.js";

const publicAccount = (account) => ({ _id: String(account._id), name: account.name, email: account.email });
const sign = (account, profileId) => jwt.sign({ sub: String(account._id), type: profileId ? "profile" : "workspace", ...(profileId ? { profileId: String(profileId) } : {}) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn, issuer: "calendar-api", audience: "calendar-assessment" });

export const authService = {
    async login(email, password) {
        const account = await authRepository.findActiveByEmailWithPassword(email.toLowerCase());
        const valid = account ? await bcrypt.compare(password, account.passwordHash) : false;
        if (!valid) throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
        return { account: publicAccount(account), token: sign(account) };
    },
    async authenticate(token) {
        let payload;
        try { payload = jwt.verify(token, config.jwtSecret, { issuer: "calendar-api", audience: "calendar-assessment" }); }
        catch { throw new AppError(401, "INVALID_TOKEN", "Your Calendar session is invalid or has expired."); }
        if (!mongoose.isValidObjectId(payload.sub) || !["workspace", "profile"].includes(payload.type)) throw new AppError(401, "INVALID_TOKEN", "Your Calendar session is invalid or has expired.");
        const account = await authRepository.findActiveById(payload.sub);
        if (!account) throw new AppError(401, "ACCOUNT_UNAVAILABLE", "This Calendar workspace is no longer available.");
        const allowed = account.allowedProfileIds.some((id) => String(id) === String(payload.profileId));
        if (payload.type === "profile" && (!payload.profileId || !allowed)) throw new AppError(403, "PROFILE_FORBIDDEN", "This profile is not available in the current workspace.");
        return { account, payload };
    },
    session(account) { return { account: publicAccount(account) }; },
    async switchProfile(account, profileId) {
        if (!account.allowedProfileIds.some((id) => String(id) === String(profileId))) throw new AppError(403, "PROFILE_FORBIDDEN", "This profile is not available in the current workspace.");
        const profile = await personService.findProfileById(profileId);
        if (!profile) throw new AppError(404, "PROFILE_NOT_FOUND", "This Calendar profile is no longer available.");
        return { profile, token: sign(account, profileId) };
    },
};
