import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import type { ILogger } from "@croco/framework-context";
import {
  clearMeteringService,
  getMeteredMetadata,
  getMeteringService,
  Metered,
  runWithMeteringService,
  setMeteringService,
} from "../../libs/decorators/Metered";
import type { MeteringService } from "../../libs/MeteringService";

describe("@Metered decorator", () => {
  let mockService!: MeteringService;

  beforeEach(() => {
    clearMeteringService();
    mockService = {
      record: vi.fn().mockResolvedValue({ id: "usage-123" }),
      getUsage: vi.fn().mockResolvedValue(0),
    } as unknown as MeteringService;

    setMeteringService(mockService);
  });

  describe("basic usage", () => {
    it("should call original method and return result", async () => {
      class TestService {
        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<string> {
          return "result";
        }
      }

      const service = new TestService();
      const result = await service.doSomething();

      expect(result).toBe("result");
    });

    it("should call MeteringService.record after method execution", async () => {
      class TestService {
        tenantId = "tenant-1";

        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<string> {
          return "result";
        }
      }

      const service = new TestService();
      await service.doSomething();

      expect(mockService.record).toHaveBeenCalledWith({
        tenantId: "tenant-1",
        meterId: "api_calls",
        value: 1,
        idempotencyKey: undefined,
        metadata: undefined,
      });
    });

    it("should use default value of 1", async () => {
      class TestService {
        tenantId = "tenant-1";

        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<void> {}
      }

      const service = new TestService();
      await service.doSomething();

      expect(mockService.record).toHaveBeenCalledWith(expect.objectContaining({ value: 1 }));
    });
  });

  describe("valueExtractor", () => {
    it("should use custom value extractor", async () => {
      class TestService {
        tenantId = "tenant-1";

        @Metered({
          meterId: "data_transfer",
          valueExtractor: (_args, result) => (result as { size: number }).size,
        })
        async transferData(): Promise<{ size: number }> {
          return { size: 1024 };
        }
      }

      const service = new TestService();
      await service.transferData();

      expect(mockService.record).toHaveBeenCalledWith(expect.objectContaining({ value: 1024 }));
    });

    it("should pass args to value extractor", async () => {
      class TestService {
        tenantId = "tenant-1";

        @Metered({
          meterId: "api_calls",
          valueExtractor: (args) => (args[0] as number) * 2,
        })
        async processItems(_count: number): Promise<void> {}
      }

      const service = new TestService();
      await service.processItems(5);

      expect(mockService.record).toHaveBeenCalledWith(expect.objectContaining({ value: 10 }));
    });
  });

  describe("idempotencyKeyExtractor", () => {
    it("should use custom idempotency key extractor", async () => {
      class TestService {
        tenantId = "tenant-1";

        @Metered({
          meterId: "api_calls",
          idempotencyKeyExtractor: (args) => (args[0] as { id: string }).id,
        })
        async processRequest(_req: { id: string }): Promise<void> {}
      }

      const service = new TestService();
      await service.processRequest({ id: "req-123" });

      expect(mockService.record).toHaveBeenCalledWith(
        expect.objectContaining({ idempotencyKey: "req-123" }),
      );
    });
  });

  describe("metadataExtractor", () => {
    it("should use custom metadata extractor", async () => {
      class TestService {
        tenantId = "tenant-1";

        @Metered({
          meterId: "api_calls",
          metadataExtractor: (args) => ({ userId: (args[0] as { userId: string }).userId }),
        })
        async handleRequest(_req: { userId: string }): Promise<void> {}
      }

      const service = new TestService();
      await service.handleRequest({ userId: "user-456" });

      expect(mockService.record).toHaveBeenCalledWith(
        expect.objectContaining({ metadata: { userId: "user-456" } }),
      );
    });
  });

  describe("fail-safe behavior", () => {
    let mockLogger: ILogger;

    beforeEach(() => {
      Container.reset();
      mockLogger = {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        child: vi.fn().mockReturnThis(),
      };
      Container.set(LOGGER_TOKEN, mockLogger);
    });

    it("should return result even if metering fails and log via DI logger", async () => {
      vi.mocked(mockService.record).mockRejectedValue(new Error("Metering error"));

      class TestService {
        tenantId = "tenant-1";

        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<string> {
          return "success";
        }
      }

      const service = new TestService();
      const result = await service.doSomething();

      expect(result).toBe("success");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should fallback to console.error if DI logger fails", async () => {
      vi.spyOn(Container, "get").mockImplementationOnce((token) => {
        if (token === LOGGER_TOKEN) {
          throw new Error("ServiceNotFoundError");
        }
        return Container.get(token);
      });
      vi.mocked(mockService.record).mockRejectedValue(new Error("Metering error"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      class TestService {
        tenantId = "tenant-1";

        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<string> {
          return "success";
        }
      }

      const service = new TestService();
      const result = await service.doSomething();

      expect(result).toBe("success");
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe("without MeteringService", () => {
    it("should work without MeteringService set", async () => {
      clearMeteringService();

      class TestService {
        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<string> {
          return "result";
        }
      }

      const service = new TestService();
      const result = await service.doSomething();

      expect(result).toBe("result");
    });
  });

  describe("metadata functions", () => {
    it("should store metadata on method", () => {
      class TestService {
        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<void> {}
      }

      const metadata = getMeteredMetadata(TestService.prototype, "doSomething");

      expect(metadata).not.toBeUndefined();
      expect(metadata?.meterId).toBe("api_calls");
    });

    it("should return undefined for undecorated method", () => {
      class TestService {
        async plainMethod(): Promise<void> {}
      }

      const metadata = getMeteredMetadata(TestService.prototype, "plainMethod");

      expect(metadata).toBeUndefined();
    });
  });

  describe("setMeteringService / getMeteringService", () => {
    it("should set and get service", () => {
      setMeteringService(mockService);

      expect(getMeteringService()).toBe(mockService);
    });
  });

  describe("runWithMeteringService", () => {
    it("should prefer scoped service over global default", async () => {
      const scopedService = {
        record: vi.fn().mockResolvedValue({ id: "usage-scoped" }),
        getUsage: vi.fn().mockResolvedValue(0),
      } as unknown as MeteringService;

      class TestService {
        tenantId = "tenant-1";

        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<string> {
          return "result";
        }
      }

      const service = new TestService();

      await runWithMeteringService(scopedService, async () => {
        await service.doSomething();
      });

      expect(scopedService.record).toHaveBeenCalledTimes(1);
      expect(mockService.record).not.toHaveBeenCalled();
    });

    it("should restore the global default after scoped execution ends", async () => {
      const scopedService = {
        record: vi.fn().mockResolvedValue({ id: "usage-scoped" }),
        getUsage: vi.fn().mockResolvedValue(0),
      } as unknown as MeteringService;

      class TestService {
        tenantId = "tenant-1";

        @Metered({ meterId: "api_calls" })
        async doSomething(): Promise<string> {
          return "result";
        }
      }

      const service = new TestService();

      await runWithMeteringService(scopedService, async () => {
        await service.doSomething();
      });
      await service.doSomething();

      expect(scopedService.record).toHaveBeenCalledTimes(1);
      expect(mockService.record).toHaveBeenCalledTimes(1);
    });
  });
});
