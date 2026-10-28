import { getTestInstance } from "better-auth/test";
import { magicLink } from "better-auth/plugins";
import { magicLinkClient } from "better-auth/client/plugins";
import { describe, expect, it, vi } from "vitest";

describe("Better Auth verification purpose", () => {
  it.each(["plain", "hashed"] as const)(
    "should reject OAuth state as a Magic Link while accepting a delivered %s token",
    async (storage) => {
      let deliveredToken = "";
      const { auth, client, testUser, db } = await getTestInstance(
        {
          verification: { storeIdentifier: storage },
          plugins: [
            magicLink({
              storeToken: storage,
              async sendMagicLink({ token }) {
                deliveredToken = token;
              },
            }),
          ],
        },
        { clientOptions: { plugins: [magicLinkClient()] } },
      );
      const authorization = await auth.api.signInSocial({
        body: {
          provider: "github",
          disableRedirect: true,
          additionalData: { email: testUser.email },
        },
      });
      expect(authorization.url).toBeTypeOf("string");
      const state = authorization.url ? new URL(authorization.url).searchParams.get("state") : null;
      expect(state).toBeTruthy();
      const sessionsBefore = await db.findMany({ model: "session" });
      const rejected = vi.fn();

      await client.magicLink.verify({ query: { token: state ?? "" } }, { onError: rejected });

      expect(rejected).toHaveBeenCalledOnce();
      expect(rejected.mock.calls[0]?.[0].response.headers.get("location")).toContain(
        "error=INVALID_TOKEN",
      );
      expect(await db.findMany({ model: "session" })).toEqual(sessionsBefore);

      await client.signIn.magicLink({ email: testUser.email });
      expect(deliveredToken).not.toBe("");
      const verified = await client.magicLink.verify({ query: { token: deliveredToken } });
      expect(verified.error).toBeNull();
      expect(verified.data?.user).toMatchObject({ email: testUser.email, emailVerified: true });
      expect(verified.data?.token).toBeTypeOf("string");
    },
  );
});
