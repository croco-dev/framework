import "reflect-metadata";
import { getTestInstance } from "better-auth/test";
import { admin, createAccessControl } from "better-auth/plugins";
import { describe, expect, it, vi } from "vitest";
import { BetterAuthSessionManager } from "../libs/BetterAuthSessionManager";

describe("BetterAuthSessionManager integration", () => {
  it("should preserve another user's stored session without sending a revocation request", async () => {
    const { auth, db, signInWithTestUser } = await getTestInstance({ plugins: [admin()] });
    const alice = await signInWithTestUser();
    const bob = await auth.api.signUpEmail({
      body: {
        email: "bob@example.com",
        password: "test-password-123",
        name: "Bob",
      },
    });
    if (!bob.token) {
      throw new Error("Better Auth did not persist Bob's session");
    }
    const aliceSession = await db.findOne<{ token: string }>({
      model: "session",
      where: [{ field: "userId", value: alice.user.id }],
    });
    if (!aliceSession) {
      throw new Error("Better Auth did not persist Alice's session");
    }
    const revokeSpy = vi.spyOn(auth.api, "revokeSession");
    const manager = new BetterAuthSessionManager({ getAuth: () => auth });

    await expect(manager.revokeSession(bob.token, aliceSession.token)).rejects.toMatchObject({
      code: "auth-better-auth/session-not-found",
      detail: "Session with id '[Redacted]' not found",
    });
    expect(revokeSpy).not.toHaveBeenCalled();
    await expect(
      db.findOne({ model: "session", where: [{ field: "token", value: bob.token }] }),
    ).resolves.toMatchObject({ token: bob.token, userId: bob.user.id });
    await expect(
      db.findOne({ model: "session", where: [{ field: "token", value: aliceSession.token }] }),
    ).resolves.toMatchObject({ token: aliceSession.token, userId: alice.user.id });
  });

  it("should preserve Better Auth revocation authorization while detecting missing targets", async () => {
    const statements = { session: ["revoke"] } as const;
    const accessControl = createAccessControl(statements);
    const { auth, db, signInWithTestUser } = await getTestInstance({
      plugins: [
        admin({
          ac: accessControl,
          roles: { "session-revoker": accessControl.newRole(statements) },
        }),
      ],
    });
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
      update: { role: "session-revoker" },
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

    await db.update({
      model: "session",
      where: [{ field: "token", value: administratorSession.token }],
      update: { createdAt: new Date(Date.now() - 25 * 60 * 60 * 1000) },
    });

    const manager = new BetterAuthSessionManager({ getAuth: () => auth });

    await expect(manager.revokeSession("", "invalid-auth")).rejects.toMatchObject({
      code: "auth-better-auth/session-not-found",
    });

    await expect(manager.revokeSession("", administratorSession.token)).rejects.toMatchObject({
      code: "auth-better-auth/session-not-found",
      detail: "Session with id '[Redacted]' not found",
    });

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

    await expect(
      manager.revokeUserSessions("missing-user-id", administratorSession.token),
    ).rejects.toMatchObject({
      code: "auth-better-auth/user-not-found",
      detail: "User with id 'missing-user-id' not found",
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
