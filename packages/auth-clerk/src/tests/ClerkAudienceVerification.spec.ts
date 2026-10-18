import { generateKeyPairSync, sign } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ClerkAuthProvider } from "../libs/ClerkAuthProvider";

const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwtKey = publicKey.export({ type: "spki", format: "pem" }).toString();
function request(aud?: unknown) {
  const now = Math.floor(Date.now() / 1000);
  const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString("base64url");
  const body = `${encode({ alg: "RS256", typ: "JWT", kid: "audience-fixture" })}.${encode({
    sub: "user_audience",
    sid: "sess_audience",
    iss: "https://fixture.clerk.accounts.dev",
    iat: now,
    nbf: now - 10,
    exp: now + 60,
    ...(aud === undefined ? {} : { aud }),
  })}`;
  const token = `${body}.${sign("RSA-SHA256", Buffer.from(body), privateKey).toString("base64url")}`;
  return { headers: new Headers({ Authorization: `Bearer ${token}` }) };
}
const options = { secretKey: "sk_test_local_audience", jwtKey };

describe("Clerk audience verification with actual SDK and signed JWTs", () => {
  it.each([undefined, ["untrusted-api"], ["trusted-api", 42], []])(
    "rejects missing, disjoint or malformed aud %j",
    async (aud) => {
      const provider = new ClerkAuthProvider({ ...options, audience: "trusted-api" });
      await expect(provider.authenticate(request(aud))).rejects.toMatchObject({
        code: "auth-clerk/token-verification-failed",
      });
    },
  );
  it.each([
    ["trusted-api", "trusted-api"],
    ["trusted-api", ["other-api", "trusted-api"]],
    [["alternate-api", "trusted-api"], "trusted-api"],
    [
      ["alternate-api", "trusted-api"],
      ["other-api", "alternate-api"],
    ],
  ])(
    "accepts an intersection between configured %j and signed %j audiences",
    async (audience, aud) => {
      const provider = new ClerkAuthProvider({ ...options, audience });
      await expect(provider.authenticate(request(aud))).resolves.toMatchObject({
        id: "user_audience",
      });
    },
  );
  it.each([{ audience: "" }, { audience: [] }])(
    "fails closed for an empty configured audience $audience",
    async ({ audience }) => {
      await expect(
        new ClerkAuthProvider({ ...options, audience }).authenticate(request("")),
      ).rejects.toMatchObject({ code: "auth-clerk/token-verification-failed" });
    },
  );
  it("preserves legacy authentication when no audience restriction is configured", async () => {
    await expect(new ClerkAuthProvider(options).authenticate(request())).resolves.toMatchObject({
      id: "user_audience",
    });
  });
});
