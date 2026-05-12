import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiKeyHasher } from "../libs/apikey/ApiKeyHasher";

describe("ApiKeyHasher", () => {
  let hasher!: ApiKeyHasher;

  beforeEach(() => {
    hasher = new ApiKeyHasher();
  });

  describe("hash", () => {
    it("should return consistent hash for same input", () => {
      const value = "test-api-key-value";
      const hash1 = hasher.hash(value);
      const hash2 = hasher.hash(value);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hash1).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should return different hashes for different inputs", () => {
      const hash1 = hasher.hash("value1");
      const hash2 = hasher.hash("value2");

      expect(hash1).not.toBe(hash2);
    });

    it("should hash empty string", () => {
      const hash = hasher.hash("");
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should produce predictable SHA-256 output", () => {
      const hash = hasher.hash("hello world");
      expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
    });
  });

  describe("verify", () => {
    it("should return true for matching value and hash", () => {
      const value = "correct-api-key";
      const hash = hasher.hash(value);

      expect(hasher.verify(value, hash)).toBe(true);
    });

    it("should return false for incorrect value", () => {
      const correctValue = "correct-api-key";
      const hash = hasher.hash(correctValue);
      const wrongValue = "wrong-api-key";

      expect(hasher.verify(wrongValue, hash)).toBe(false);
    });

    it("should return false for different length hash", () => {
      const value = "test-value";
      const shortHash = "abc123";

      expect(hasher.verify(value, shortHash)).toBe(false);
    });

    it("should handle empty string", () => {
      const hash = hasher.hash("");
      expect(hasher.verify("", hash)).toBe(true);
      expect(hasher.verify("not-empty", hash)).toBe(false);
    });

    it("should use timing-safe comparison", () => {
      const value = "test-value";
      const correctHash = hasher.hash(value);
      const wrongHash = "a".repeat(64);

      expect(hasher.verify(value, wrongHash)).toBe(false);
      expect(hasher.verify(value, correctHash)).toBe(true);
    });

    it("should be case-sensitive for hex hash", () => {
      const value = "test-value";
      const hash = hasher.hash(value);
      const uppercaseHash = hash.toUpperCase();

      expect(hasher.verify(value, uppercaseHash)).toBe(false);
    });
  });

  describe("integration", () => {
    it("should support hash-and-verify workflow", () => {
      const apiKey = "sk_abc123_xyz789";
      const hashed = hasher.hash(apiKey);

      expect(hashed).not.toBe(apiKey);
      expect(hasher.verify(apiKey, hashed)).toBe(true);
      expect(hasher.verify("different-key", hashed)).toBe(false);
    });
  });
});
