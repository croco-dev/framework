import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  AesGcmInvitationTokenCipher,
  InvitationTokenCipherProblem,
} from "../libs/InvitationTokenCipher";

describe("AesGcmInvitationTokenCipher", () => {
  const context = {
    tenantId: "tenant-1",
    invitationId: "invitation-1",
    idempotencyKey: "request-1",
  };

  it("should round-trip a token without embedding plaintext", () => {
    const cipher = new AesGcmInvitationTokenCipher({
      activeKeyId: "current",
      keys: { current: randomBytes(32) },
    });
    const token = "bearer-token-that-must-not-be-persisted";

    const encrypted = cipher.encrypt(token, context);

    expect(encrypted).not.toContain(token);
    expect(cipher.decrypt(encrypted, context)).toBe(token);
  });

  it("should decrypt older ciphertext while a rotated key remains configured", () => {
    const oldKey = randomBytes(32);
    const newKey = randomBytes(32);
    const oldCipher = new AesGcmInvitationTokenCipher({
      activeKeyId: "old",
      keys: { old: oldKey },
    });
    const rotatedCipher = new AesGcmInvitationTokenCipher({
      activeKeyId: "new",
      keys: { old: oldKey, new: newKey },
    });

    expect(rotatedCipher.decrypt(oldCipher.encrypt("replay-token", context), context)).toBe(
      "replay-token",
    );
    expect(rotatedCipher.decrypt(rotatedCipher.encrypt("new-token", context), context)).toBe(
      "new-token",
    );
  });

  it("should round-trip a key ID containing a delimiter", () => {
    const cipher = new AesGcmInvitationTokenCipher({
      activeKeyId: "kms.v2",
      keys: { "kms.v2": randomBytes(32) },
    });

    expect(cipher.decrypt(cipher.encrypt("replay-token", context), context)).toBe("replay-token");
  });

  it("should reject tampered ciphertext", () => {
    const cipher = new AesGcmInvitationTokenCipher({
      activeKeyId: "current",
      keys: { current: randomBytes(32) },
    });
    const encrypted = cipher.encrypt("replay-token", context);
    const parts = encrypted.split(".");
    const encryptedValue = parts[3] ?? "";
    parts[3] = `${encryptedValue.startsWith("A") ? "B" : "A"}${encryptedValue.slice(1)}`;
    const tampered = parts.join(".");

    expect(() => cipher.decrypt(tampered, context)).toThrow();
  });

  it("should reject ciphertext moved to another creation row", () => {
    const cipher = new AesGcmInvitationTokenCipher({
      activeKeyId: "current",
      keys: { current: randomBytes(32) },
    });
    const encrypted = cipher.encrypt("replay-token", context);

    expect(() =>
      cipher.decrypt(encrypted, {
        ...context,
        invitationId: "invitation-2",
      }),
    ).toThrow();
  });

  it.each(["v1.%.iv.value.tag", "v1.Y3VycmVudA.iv.value.tag.extra"])(
    "should model malformed ciphertext without leaking parser errors",
    (ciphertext) => {
      const cipher = new AesGcmInvitationTokenCipher({
        activeKeyId: "current",
        keys: { current: randomBytes(32) },
      });

      expect(() => cipher.decrypt(ciphertext, context)).toThrow(InvitationTokenCipherProblem);
    },
  );
});
