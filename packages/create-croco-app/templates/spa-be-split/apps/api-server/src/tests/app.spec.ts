import { beforeEach, describe, expect, it } from "vitest";
import { createCrocoApp } from "../app";
import { getUserAuditEntries, resetUserRuntimeForTests } from "../users";

describe("API server", () => {
  beforeEach(() => {
    resetUserRuntimeForTests();
  });

  it("serves users through the operational app", async () => {
    const app = createCrocoApp();

    const response = await app.fetch(new Request("http://localhost/users"));
    const users = (await response.json()) as Array<{ id: string; name: string }>;

    expect(response.status).toBe(200);
    expect(users).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "user-1",
          name: "Ada Lovelace",
        }),
      ]),
    );
    expect(users).toHaveLength(2);
  });

  it("creates users through the operational app and publishes the domain event", async () => {
    const app = createCrocoApp();
    const response = await app.fetch(
      new Request("http://localhost/users", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ name: "Katherine Johnson", email: "katherine@example.com" }),
      }),
    );
    const user = await response.json();

    expect(response.status).toBe(200);
    expect(user).toEqual(
      expect.objectContaining({
        name: "Katherine Johnson",
        email: "katherine@example.com",
      }),
    );
    expect(getUserAuditEntries()).toContain(user.id);
  });

  it("returns RFC 7807 Problem details for missing users", async () => {
    const app = createCrocoApp();
    const response = await app.fetch(new Request("http://localhost/users/missing"));
    const problem = await response.json();

    expect(response.status).toBe(404);
    expect(problem).toEqual(
      expect.objectContaining({
        status: 404,
        code: "starter/user-not-found",
      }),
    );
  });
});
