import "reflect-metadata";
import { beforeEach, describe, expect, it } from "vitest";
import { ApiKeyGenerator } from "../libs/apikey/ApiKeyGenerator";

describe("ApiKeyGenerator", () => {
  let generator!: ApiKeyGenerator;

  beforeEach(() => {
    generator = new ApiKeyGenerator();
  });

  describe("generate", () => {
    it('should generate key with default prefix "sk"', () => {
      const result = generator.generate();

      expect(result.prefix).toBe("sk");
      expect(result.fullKey).toMatch(/^sk_[A-Za-z0-9_~-]{12}_[A-Za-z0-9_~-]{32}$/);
      expect(result.shortToken).toHaveLength(12);
      expect(result.longToken).toHaveLength(32);
    });

    it("should generate key with custom prefix", () => {
      const result = generator.generate("pk");

      expect(result.prefix).toBe("pk");
      expect(result.fullKey).toMatch(/^pk_[A-Za-z0-9_~-]{12}_[A-Za-z0-9_~-]{32}$/);
    });

    it("should generate unique keys", () => {
      const key1 = generator.generate();
      const key2 = generator.generate();

      expect(key1.fullKey).not.toBe(key2.fullKey);
      expect(key1.shortToken).not.toBe(key2.shortToken);
      expect(key1.longToken).not.toBe(key2.longToken);
    });

    it("should generate URL-safe base64 tokens", () => {
      const result = generator.generate();

      expect(result.shortToken).toMatch(/^[A-Za-z0-9_~-]+$/);
      expect(result.longToken).toMatch(/^[A-Za-z0-9_~-]+$/);
      expect(result.fullKey).not.toContain("+");
      expect(result.fullKey).not.toContain("/");
      expect(result.fullKey).not.toContain("=");
    });
  });

  describe("parse", () => {
    it("should parse valid key correctly", () => {
      const result = generator.generate();
      const parsed = generator.parse(result.fullKey);

      expect(parsed).not.toBeNull();
      expect(parsed?.prefix).toBe(result.prefix);
      expect(parsed?.shortToken).toBe(result.shortToken);
      expect(parsed?.longToken).toBe(result.longToken);
    });

    it("should return null for invalid format - missing parts", () => {
      expect(generator.parse("sk_token")).toBeNull();
      expect(generator.parse("sk_token_value_extra")).toBeNull();
    });

    it("should return null for empty string", () => {
      expect(generator.parse("")).toBeNull();
    });

    it("should return null for key with empty parts", () => {
      expect(generator.parse("sk__longtoken")).toBeNull();
      expect(generator.parse("sk_short_")).toBeNull();
      expect(generator.parse("_short_long")).toBeNull();
    });

    it("should return null for key without separators", () => {
      expect(generator.parse("skshortlong")).toBeNull();
    });
  });

  describe("generate and parse roundtrip", () => {
    it("should successfully parse generated key", () => {
      const generated = generator.generate("test");
      const parsed = generator.parse(generated.fullKey);

      expect(parsed).toEqual({
        prefix: "test",
        shortToken: generated.shortToken,
        longToken: generated.longToken,
      });
    });
  });

  describe("custom lengths", () => {
    it("should support custom token lengths", () => {
      const customGenerator = new ApiKeyGenerator(8, 16);
      const result = customGenerator.generate();

      expect(result.shortToken).toHaveLength(8);
      expect(result.longToken).toHaveLength(16);
      expect(result.fullKey).toMatch(/^sk_[A-Za-z0-9_~-]{8}_[A-Za-z0-9_~-]{16}$/);
    });
  });
});
