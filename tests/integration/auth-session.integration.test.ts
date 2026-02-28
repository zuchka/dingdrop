import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { login, register } from "~/lib/auth.server";
import { createUserSession, getUserId, requireUserId } from "~/lib/session.server";
import { disconnectDatabase, resetDatabase, uniqueValue } from "../helpers/db";

describe("integration: auth + session", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  afterAll(async () => {
    await disconnectDatabase();
  });

  it("registers and logs in a user", async () => {
    const email = `${uniqueValue("user")}@example.com`;
    const password = "strong-password";

    const user = await register(email, password);
    expect(user.email).toBe(email);

    const loggedIn = await login(email, password);
    expect(loggedIn?.id).toBe(user.id);
  });

  it("creates and reads session cookie", async () => {
    const email = `${uniqueValue("session-user")}@example.com`;
    const user = await register(email, "strong-password");

    const req = new Request("http://localhost/login");

    let response: Response | null = null;
    try {
      await createUserSession({ request: req, userId: user.id, redirectTo: "/app" });
    } catch (thrown) {
      response = thrown as Response;
    }

    expect(response).not.toBeNull();
    expect(response?.status).toBe(302);
    const cookie = response?.headers.get("Set-Cookie");
    expect(cookie).toBeTruthy();

    const authedRequest = new Request("http://localhost/app", {
      headers: { Cookie: cookie as string },
    });

    const userId = await getUserId(authedRequest);
    expect(userId).toBe(user.id);
  });

  it("redirects unauthenticated requireUserId", async () => {
    const req = new Request("http://localhost/app/orgs");

    await expect(requireUserId(req)).rejects.toBeInstanceOf(Response);
  });
});
