import { afterAll, beforeAll, beforeEach, describe, expect, test } from "@jest/globals";
import { PASSWORD, api, as, closeDatabase, createWorkspace, errorCode, openDatabase, resetDatabase, signIn, signInWorkspace } from "./support/api.js";

let people;

beforeAll(openDatabase);
beforeEach(async () => {
    await resetDatabase();
    ({ people } = await createWorkspace());
});
afterAll(closeDatabase);

describe("Sign-in and profiles", () => {
    test("signs in with the right password and refuses a wrong one", async () => {
        const signedIn = await api().post("/api/v1/auth/login").send({ email: people.alex.email, password: PASSWORD });
        const refused = await api().post("/api/v1/auth/login").send({ email: people.alex.email, password: "not-the-password" });

        expect(signedIn.status).toBe(200);
        expect(signedIn.body.data.account.email).toBe(people.alex.email);
        expect(signedIn.body.data.token).toEqual(expect.any(String));
        expect(refused.status).toBe(401);
        expect(errorCode(refused)).toBe("INVALID_CREDENTIALS");
    });

    test("refuses a request with no token or a bad token", async () => {
        const noToken = await api().get("/api/v1/calendars");
        const badToken = await as("not-a-real-token").get("/api/v1/calendars");

        expect(noToken.status).toBe(401);
        expect(errorCode(noToken)).toBe("AUTH_REQUIRED");
        expect(badToken.status).toBe(401);
        expect(errorCode(badToken)).toBe("INVALID_TOKEN");
    });

    test("needs a profile before it reads any calendar data", async () => {
        const workspaceToken = await signInWorkspace(people.alex);

        const response = await as(workspaceToken).get("/api/v1/calendars");

        expect(response.status).toBe(401);
        expect(errorCode(response)).toBe("PROFILE_REQUIRED");
    });

    test("switches only to a profile the account may use", async () => {
        const workspaceToken = await signInWorkspace(people.alex);

        const profiles = await as(workspaceToken).get("/api/v1/profiles");
        const own = await as(workspaceToken).post("/api/v1/auth/switch-profile", { profileId: String(people.alex._id) });
        const someoneElse = await as(workspaceToken).post("/api/v1/auth/switch-profile", { profileId: String(people.jordan._id) });
        const calendars = await as(own.body.data.token).get("/api/v1/calendars");

        expect(profiles.body.data.map((profile) => profile.name)).toEqual(["Alex Morgan"]);
        expect(own.status).toBe(200);
        expect(calendars.status).toBe(200);
        expect(someoneElse.status).toBe(403);
        expect(errorCode(someoneElse)).toBe("PROFILE_FORBIDDEN");
    });

    test("returns the signed-in account and signs out", async () => {
        const token = await signIn(people.alex);

        const session = await as(token).get("/api/v1/auth/session");
        const signedOut = await as(token).post("/api/v1/auth/logout");

        expect(session.status).toBe(200);
        expect(session.body.data.account.email).toBe(people.alex.email);
        expect(signedOut.status).toBe(204);
    });
});
