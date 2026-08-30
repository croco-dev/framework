import "reflect-metadata";
import { getTestInstance } from "better-auth/test";
import { admin } from "better-auth/plugins";
import { describe, expect, it } from "vitest";
import { BetterAuthSessionManager } from "../libs/BetterAuthSessionManager";

describe("BetterAuthSessionManager integration", () => {
  it("should revoke existing sessions and reject missing targets through Better Auth", async () => {
    const { auth, db, signInWithTestUser } = await getTestInstance({ plugins: [admin()] });
    const target = await signInWithTestUser();
    const targetSession = await db.findOne<{ token: string }>({
      model: "session",
      where: [{ field: "userId", value: target.user.id }],
    });

    expect(targetSession).not.toBeNull();
    if (!targetSession) {
      throw new Error("Better Auth did not persist the target session");
    }

    await db.update({
      model: "user",
      where: [{ field: "id", value: target.user.id }],
      update: { role: "admin" },
    });

    await signInWithTestUser();
    const administratorSession = (
      await db.findMany<{ token: string }>({
        model: "session",
        where: [{ field: "userId", value: target.user.id }],
      })
    ).find((session) => session.token !== targetSession.token);

    expect(administratorSession).not.toBeUndefined();
    if (!administratorSession) {
      throw new Error("Better Auth did not persist the administrator session");
    }

    const manager = new BetterAuthSessionManager({ getAuth: () => auth });

    await manager.revokeSession(targetSession.token, administratorSession.token);

    await expect(
      db.findOne({
        model: "session",
        where: [{ field: "token", value: targetSession.token }],
      }),
    ).resolves.toBeNull();

    await expect(
      manager.revokeSession("missing-session-token", administratorSession.token),
    ).rejects.toMatchObject({
      code: "auth-better-auth/session-not-found",
      detail: "Session with id '[Redacted]' not found",
    });

    await manager.revokeUserSessions(target.user.id, administratorSession.token);

    await expect(
      db.findOne({
        model: "session",
        where: [{ field: "token", value: administratorSession.token }],
      }),
    ).resolves.toBeNull();
  });
});
