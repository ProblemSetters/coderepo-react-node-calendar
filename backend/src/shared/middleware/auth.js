import { AppError } from "../errors/app-error.js";
import { authService } from "../../features/auth/auth.service.js";

const legacyTestBypassEnabled = () => process.env.NODE_ENV === "test" && process.env.CALENDAR_TEST_AUTH_BYPASS === "true";

export async function requireWorkspaceAuth(request, response, next) {
    try {
        const authorization = request.get("authorization") || "";
        if (!authorization.startsWith("Bearer ")) {
            if (legacyTestBypassEnabled() && !request.originalUrl.startsWith("/api/v1/auth/")) return next();
            throw new AppError(401, "AUTH_REQUIRED", "Sign in to the Calendar workspace to continue.");
        }
        const token = authorization.slice(7).trim();
        if (!token) throw new AppError(401, "AUTH_REQUIRED", "Sign in to the Calendar workspace to continue.");
        const { account, payload } = await authService.authenticate(token);
        request.account = account;
        request.auth = payload;
        next();
    } catch (error) { next(error); }
}
