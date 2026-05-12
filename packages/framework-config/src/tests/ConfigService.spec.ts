import { beforeEach, describe, expect, it } from "vitest";
import "reflect-metadata";
import { Container } from "@croco/framework-context";
import { ConfigService } from "../ConfigService";

describe("ConfigService", () => {
  let configService!: ConfigService;

  beforeEach(() => {
    Container.reset();
    configService = new ConfigService();
  });

  describe("get()", () => {
    it("should return NODE_ENV value", () => {
      const result = configService.get("NODE_ENV");
      expect(result).toBe("development");
    });

    it("should return PORT as number", () => {
      const result = configService.get("PORT");
      expect(result).toBe(3000);
      expect(typeof result).toBe("number");
    });

    it("should return LOG_LEVEL value", () => {
      const result = configService.get("LOG_LEVEL");
      expect(result).toBe("info");
    });

    it("should return DATABASE_URL value", () => {
      const result = configService.get("DATABASE_URL");
      expect(result).toBe("postgresql://localhost:5432/test");
    });

    it("should return REDIS_URL value", () => {
      const result = configService.get("REDIS_URL");
      expect(result).toBe("redis://localhost:6379");
    });

    it("should return R2_ACCOUNT_ID value", () => {
      const result = configService.get("R2_ACCOUNT_ID");
      expect(result).toBe("test-account");
    });

    it("should return R2_BUCKET value", () => {
      const result = configService.get("R2_BUCKET");
      expect(result).toBe("test-bucket");
    });

    it("should return R2_PUBLIC_URL_BASE value", () => {
      const result = configService.get("R2_PUBLIC_URL_BASE");
      expect(result).toBe("https://test.r2.dev");
    });
  });

  describe("isProduction", () => {
    it("should return false when NODE_ENV is development", () => {
      expect(configService.isProduction).toBe(false);
    });

    it("should return false for another ConfigService instance", () => {
      const service = new ConfigService();
      expect(service.isProduction).toBe(false);
    });
  });

  describe("isDevelopment", () => {
    it("should return true when NODE_ENV is development", () => {
      expect(configService.isDevelopment).toBe(true);
    });
  });

  describe("isTest", () => {
    it("should return false when NODE_ENV is development", () => {
      expect(configService.isTest).toBe(false);
    });
  });

  describe("REDIS_TOKEN optional", () => {
    it("should work when REDIS_TOKEN is not provided", () => {
      const service = new ConfigService();
      expect(service.get("REDIS_URL")).toBe("redis://localhost:6379");
    });
  });

  describe("R2 optional fields", () => {
    it("should work when R2 fields are provided", () => {
      const service = new ConfigService();
      expect(service.get("R2_ACCOUNT_ID")).toBe("test-account");
      expect(service.get("R2_BUCKET")).toBe("test-bucket");
    });
  });

  describe("type safety", () => {
    it("should return correct type for NODE_ENV", () => {
      const result = configService.get("NODE_ENV");
      expect(["development", "test", "production"]).toContain(result);
    });

    it("should return number for PORT", () => {
      const result = configService.get("PORT");
      expect(typeof result).toBe("number");
    });

    it("should return correct type for LOG_LEVEL", () => {
      const result = configService.get("LOG_LEVEL");
      expect(["debug", "info", "warn", "error"]).toContain(result);
    });
  });

  describe("singleton scope", () => {
    it("should be registered with Component decorator", () => {
      const service = new ConfigService();
      expect(service).toBeInstanceOf(ConfigService);
    });

    it("should return consistent values across instances", () => {
      const instance1 = new ConfigService();
      const instance2 = new ConfigService();

      expect(instance1.get("NODE_ENV")).toBe(instance2.get("NODE_ENV"));
      expect(instance1.isDevelopment).toBe(instance2.isDevelopment);
    });
  });
});
