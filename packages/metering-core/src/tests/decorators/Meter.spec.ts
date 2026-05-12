import "reflect-metadata";
import { describe, expect, it } from "vitest";
import {
  getMeterMetadata,
  hasMeterMetadata,
  METER_METADATA_KEY,
  Meter,
} from "../../libs/decorators/Meter";

describe("@Meter decorator", () => {
  describe("basic usage", () => {
    it("should store metadata on class", () => {
      @Meter({ meterId: "api_calls" })
      class TestController {}

      const metadata = getMeterMetadata(TestController);

      expect(metadata).not.toBeUndefined();
      expect(metadata?.meterId).toBe("api_calls");
    });

    it("should use default type COUNT", () => {
      @Meter({ meterId: "api_calls" })
      class TestController {}

      const metadata = getMeterMetadata(TestController);

      expect(metadata?.type).toBe("COUNT");
    });

    it("should use default allowOverQuota false", () => {
      @Meter({ meterId: "api_calls" })
      class TestController {}

      const metadata = getMeterMetadata(TestController);

      expect(metadata?.allowOverQuota).toBe(false);
    });
  });

  describe("with options", () => {
    it("should store custom type", () => {
      @Meter({ meterId: "mau", type: "UNIQUE_COUNT" })
      class TestController {}

      const metadata = getMeterMetadata(TestController);

      expect(metadata?.type).toBe("UNIQUE_COUNT");
    });

    it("should store quota", () => {
      @Meter({ meterId: "api_calls", quota: 1000 })
      class TestController {}

      const metadata = getMeterMetadata(TestController);

      expect(metadata?.quota).toBe(1000);
    });

    it("should store allowOverQuota true", () => {
      @Meter({ meterId: "api_calls", allowOverQuota: true })
      class TestController {}

      const metadata = getMeterMetadata(TestController);

      expect(metadata?.allowOverQuota).toBe(true);
    });

    it("should store all options", () => {
      @Meter({
        meterId: "storage",
        type: "CUSTOM_EVENT",
        quota: 5000,
        allowOverQuota: true,
      })
      class TestController {}

      const metadata = getMeterMetadata(TestController);

      expect(metadata).toEqual({
        meterId: "storage",
        type: "CUSTOM_EVENT",
        quota: 5000,
        allowOverQuota: true,
      });
    });
  });

  describe("hasMeterMetadata", () => {
    it("should return true for decorated class", () => {
      @Meter({ meterId: "api_calls" })
      class DecoratedClass {}

      expect(hasMeterMetadata(DecoratedClass)).toBe(true);
    });

    it("should return false for undecorated class", () => {
      class PlainClass {}

      expect(hasMeterMetadata(PlainClass)).toBe(false);
    });
  });

  describe("getMeterMetadata", () => {
    it("should return undefined for undecorated class", () => {
      class PlainClass {}

      const metadata = getMeterMetadata(PlainClass);

      expect(metadata).toBeUndefined();
    });
  });

  describe("metadata key", () => {
    it("should use unique symbol key", () => {
      expect(typeof METER_METADATA_KEY).toBe("symbol");
    });

    it("should be accessible via Reflect.getMetadata", () => {
      @Meter({ meterId: "test" })
      class TestClass {}

      const metadata = Reflect.getMetadata(METER_METADATA_KEY, TestClass);

      expect(metadata).not.toBeUndefined();
      expect(metadata.meterId).toBe("test");
    });
  });

  describe("multiple classes", () => {
    it("should store independent metadata for each class", () => {
      @Meter({ meterId: "api_calls", quota: 1000 })
      class ApiController {}

      @Meter({ meterId: "storage", quota: 5000 })
      class StorageController {}

      const apiMetadata = getMeterMetadata(ApiController);
      const storageMetadata = getMeterMetadata(StorageController);

      expect(apiMetadata?.meterId).toBe("api_calls");
      expect(apiMetadata?.quota).toBe(1000);
      expect(storageMetadata?.meterId).toBe("storage");
      expect(storageMetadata?.quota).toBe(5000);
    });
  });
});
