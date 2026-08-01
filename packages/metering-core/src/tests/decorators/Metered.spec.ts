import "reflect-metadata";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container, LOGGER_TOKEN } from "@croco/framework-context";
import type { ILogger } from "@croco/framework-context";
import {
  clearMeteringService,
  getMeteredMetadata,
  getMeteringService,
  METERED_METADATA_KEY,
  Metered,
  runWithMeteringService,
  setMeteringService,
} from "../../libs/decorators/Metered";
import { defineMeter, dimension } from "../../libs/MeterRef";
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

  it("publishes metadata through the shared ContractGraph key", () => {
    expect(METERED_METADATA_KEY).toBe(Symbol.for("croco:metering:metered"));
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

    it("should record COUNT meter refs through the typed service path", async () => {
      const meter = defineMeter({
        key: "api.calls",
        aggregation: "COUNT",
        unit: "request",
      });

      class TestService {
        tenantId = "tenant-1";

        @Metered({ meter })
        async doSomething(): Promise<void> {}
      }

      await new TestService().doSomething();

      expect(mockService.record).toHaveBeenCalledWith(meter, {
        tenantId: "tenant-1",
        value: 1,
        eventId: undefined,
        dimensions: undefined,
        metadata: undefined,
      });
      expect(getMeteredMetadata(TestService.prototype, "doSomething")?.meter).toBe(meter);
    });

    it("should extract event identity for billing-required COUNT meter refs", async () => {
      const meter = defineMeter({
        key: "api.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });

      class TestService {
        tenantId = "tenant-1";

        @Metered({
          meter,
          eventIdExtractor: (args) => (args[0] as { requestId: string }).requestId,
        })
        async doSomething(_request: { requestId: string }): Promise<void> {}
      }

      await new TestService().doSomething({ requestId: "request-1" });

      expect(mockService.record).toHaveBeenCalledWith(
        meter,
        expect.objectContaining({ eventId: "request-1" }),
      );
    });

    it("should pass extracted dimensions through the typed service path", async () => {
      const meter = defineMeter({
        key: "ai.tokens",
        aggregation: "COUNT",
        unit: "token",
        dimensions: {
          model: dimension.enum(["gpt-5", "gpt-5-mini"]),
        },
      });

      class TestService {
        tenantId = "tenant-1";

        @Metered({
          meter,
          dimensionsExtractor: (args) => ({
            model: (args[0] as { model: "gpt-5" | "gpt-5-mini" }).model,
          }),
        })
        async doSomething(_request: { model: "gpt-5" | "gpt-5-mini" }): Promise<void> {}
      }

      await new TestService().doSomething({ model: "gpt-5" });

      expect(mockService.record).toHaveBeenCalledWith(
        meter,
        expect.objectContaining({ dimensions: { model: "gpt-5" } }),
      );
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

    it("should return the original result when a local dimensions extractor fails", async () => {
      const originalMethod = vi.fn().mockResolvedValue("success");
      const meter = defineMeter({
        key: "ai.tokens",
        aggregation: "COUNT",
        unit: "token",
        dimensions: {
          model: dimension.enum(["gpt-5"]),
        },
      });

      class TestService {
        @Metered({
          meter,
          dimensionsExtractor: () => {
            throw new Error("Dimension extraction failed");
          },
        })
        async doSomething(): Promise<string> {
          return originalMethod();
        }
      }

      await expect(new TestService().doSomething()).resolves.toBe("success");
      expect(originalMethod).toHaveBeenCalledTimes(1);
      expect(mockService.record).not.toHaveBeenCalled();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should return the original result when a local event ID extractor fails", async () => {
      const originalMethod = vi.fn().mockResolvedValue("success");
      const meter = defineMeter({
        key: "api.calls",
        aggregation: "COUNT",
        unit: "request",
      });

      class TestService {
        @Metered({
          meter,
          eventIdExtractor: () => {
            throw new Error("Event ID extraction failed");
          },
        })
        async doSomething(): Promise<string> {
          return originalMethod();
        }
      }

      await expect(new TestService().doSomething()).resolves.toBe("success");
      expect(originalMethod).toHaveBeenCalledTimes(1);
      expect(mockService.record).not.toHaveBeenCalled();
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

    it("should fail closed when a billing-required meter rejects the record", async () => {
      vi.mocked(mockService.record).mockRejectedValue(new Error("Billing write failed"));
      const meter = defineMeter({
        key: "api.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });

      class TestService {
        @Metered({ meter, eventIdExtractor: () => "request-1" })
        async doSomething(): Promise<string> {
          return "success";
        }
      }

      await expect(new TestService().doSomething()).rejects.toThrow("Billing write failed");
    });

    it("should fail closed when a billing-required event ID is blank", async () => {
      const originalMethod = vi.fn().mockResolvedValue("success");
      const meter = defineMeter({
        key: "api.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });

      class TestService {
        @Metered({ meter, eventIdExtractor: () => " " })
        async doSomething(): Promise<string> {
          return originalMethod();
        }
      }

      await expect(new TestService().doSomething()).rejects.toMatchObject({
        code: "metering/invalid-usage-envelope",
      });
      expect(originalMethod).not.toHaveBeenCalled();
      expect(mockService.record).not.toHaveBeenCalled();
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

    it("should fail closed for billing-required meters", async () => {
      clearMeteringService();
      const originalMethod = vi.fn().mockResolvedValue("result");
      const meter = defineMeter({
        key: "api.calls",
        aggregation: "COUNT",
        unit: "request",
        billing: "required",
      });

      class TestService {
        @Metered({ meter, eventIdExtractor: () => "request-1" })
        async doSomething(): Promise<string> {
          return originalMethod();
        }
      }

      await expect(new TestService().doSomething()).rejects.toMatchObject({
        code: "metering/invalid-usage-envelope",
      });
      expect(originalMethod).not.toHaveBeenCalled();
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
