import { describe, expect, it } from "vitest";
import {
  AesGcmApiKeyRotationProtector,
  ApiKeyRotationProtectionProblem,
} from "../libs/apikey/ApiKeyRotationProtector";

const CONTEXT = {
  oldKeyId: "old-key",
  newKeyId: "new-key",
  tenantId: "tenant-1",
  idempotencyKey: "rotation-1",
};

describe("AesGcmApiKeyRotationProtector", () => {
  it("should reject protection keys that are not 32 bytes", () => {
    expect(
      () =>
        new AesGcmApiKeyRotationProtector({
          activeKeyId: "invalid",
          keys: { invalid: new Uint8Array(31) },
        }),
    ).toThrow(ApiKeyRotationProtectionProblem);
  });

  it("should reject malformed ciphertext", () => {
    const protector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "current",
      keys: { current: new Uint8Array(32).fill(7) },
    });

    expect(() => protector.decrypt("v1.a.b.c", CONTEXT)).toThrow(ApiKeyRotationProtectionProblem);
  });

  it("should reject ciphertext encrypted by a removed key", () => {
    const oldProtector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "previous",
      keys: { previous: new Uint8Array(32).fill(3) },
    });
    const ciphertext = oldProtector.encrypt("sk_short_long-secret", CONTEXT);
    const currentProtector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "current",
      keys: { current: new Uint8Array(32).fill(7) },
    });

    expect(() => currentProtector.decrypt(ciphertext, CONTEXT)).toThrow(
      ApiKeyRotationProtectionProblem,
    );
  });

  it("should recover protected API key material", () => {
    const protector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "current",
      keys: { current: new Uint8Array(32).fill(7) },
    });

    const ciphertext = protector.encrypt("sk_short_long-secret", CONTEXT);

    expect(ciphertext).not.toContain("long-secret");
    expect(protector.decrypt(ciphertext, CONTEXT)).toBe("sk_short_long-secret");
  });

  it("should fail closed when ciphertext is moved to another rotation", () => {
    const protector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "current",
      keys: { current: new Uint8Array(32).fill(7) },
    });
    const ciphertext = protector.encrypt("sk_short_long-secret", CONTEXT);

    expect(() => protector.decrypt(ciphertext, { ...CONTEXT, newKeyId: "other-key" })).toThrow(
      ApiKeyRotationProtectionProblem,
    );
  });

  it("should decrypt records created with a retained previous key", () => {
    const previous = new Uint8Array(32).fill(3);
    const current = new Uint8Array(32).fill(7);
    const oldProtector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "previous",
      keys: { previous },
    });
    const ciphertext = oldProtector.encrypt("sk_short_long-secret", CONTEXT);
    const rotatedProtector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "current",
      keys: { current, previous },
    });

    expect(rotatedProtector.decrypt(ciphertext, CONTEXT)).toBe("sk_short_long-secret");
  });
});
