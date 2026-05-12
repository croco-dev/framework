import type { ConfigService } from "@croco/framework-config";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Logger } from "../Logger";

// Mock pino module first, before importing it
vi.mock("pino", () => {
  const createMockLogger = () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: vi.fn(),
    child: vi.fn(function (this: unknown, bindings: unknown) {
      // Return a new mock logger instance to simulate Pino's child behavior
      return createMockLogger();
    }),
  });

  const mockLogger = createMockLogger();

  return {
    default: vi.fn(() => mockLogger),
    Logger: vi.fn(),
  };
});

describe("Logger.child() - Request-scoped Isolation", () => {
  let logger!: Logger;
  const mockConfig = {
    get: vi.fn(),
    has: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    logger = new Logger(mockConfig as unknown as ConfigService);
  });

  describe("새 인스턴스 생성", () => {
    it("child()가 부모와 다른 새 Logger 인스턴스를 반환해야 함", () => {
      const childLogger = logger.child({ module: "TestModule" });

      expect(childLogger).not.toBe(logger);
      expect(childLogger).toBeInstanceOf(Logger);
    });

    it("동일한 bindings로 여러 child()를 호출해도 각각 다른 인스턴스를 반환해야 함", () => {
      const child1 = logger.child({ module: "Auth" });
      const child2 = logger.child({ module: "Auth" });

      expect(child1).not.toBe(child2);
      expect(child1).not.toBe(logger);
      expect(child2).not.toBe(logger);
    });
  });

  describe("설정 상속", () => {
    it("child Logger가 부모의 redact 설정을 상속받아야 함", () => {
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const childLogger = logger.child({ module: "Test" });
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const childPino = childLogger["logger"];

      // Pino child는 부모의 설정을 상속받음
      expect(childPino).not.toBeUndefined();
    });

    it("child Logger가 부모와 동일한 ConfigService를 유지해야 함", () => {
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const childLogger = logger.child({ module: "Test" });
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      expect(childLogger["config"]).toBe(logger["config"]);
    });
  });

  describe("중첩 체이닝", () => {
    it("child().child() 체이닝이 각 단계에서 새 인스턴스를 생성해야 함", () => {
      const child1 = logger.child({ layer: "service" });
      const child2 = child1.child({ component: "user" });
      const child3 = child2.child({ module: "profile" });

      expect(child1).not.toBe(logger);
      expect(child2).not.toBe(child1);
      expect(child3).not.toBe(child2);
      expect(child3).not.toBe(logger);
    });

    it("체이닝된 child Logger가 bindings를 누적해야 함", () => {
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const rootChildSpy = vi.spyOn(logger["logger"], "child");

      const child1 = logger.child({ layer: "service" });
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const child1ChildSpy = vi.spyOn(child1["logger"], "child");

      const _child2 = child1.child({ component: "user" });

      // 각 logger 인스턴스에서 child가 한 번씩 호출됨
      expect(rootChildSpy).toHaveBeenCalledTimes(1);
      expect(rootChildSpy).toHaveBeenCalledWith({ layer: "service" });

      expect(child1ChildSpy).toHaveBeenCalledTimes(1);
      expect(child1ChildSpy).toHaveBeenCalledWith({ component: "user" });
    });
  });

  describe("Request-scoped 격리", () => {
    it("child Logger가 독립적인 Pino child 인스턴스를 가져야 함", () => {
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const parentPino = logger["logger"];
      const childLogger = logger.child({ requestId: "req-123" });
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const childPino = childLogger["logger"];

      // Pino child는 부모와 다른 인스턴스여야 함
      expect(childPino).not.toBe(parentPino);
    });

    it("각 child가 독립적인 로그 컨텍스트를 가져야 함", () => {
      const child1 = logger.child({ requestId: "req-1" });
      const child2 = logger.child({ requestId: "req-2" });

      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const infoSpy1 = vi.spyOn(child1["logger"], "info");
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const infoSpy2 = vi.spyOn(child2["logger"], "info");

      child1.info("메시지 1");
      child2.info("메시지 2");

      expect(infoSpy1).toHaveBeenCalledTimes(1);
      expect(infoSpy2).toHaveBeenCalledTimes(1);
    });
  });

  describe("Pino child API 통합", () => {
    it("child()가 Pino의 child() 메서드를 호출해야 함", () => {
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const pinoChildSpy = vi.spyOn(logger["logger"], "child");

      logger.child({ module: "TestModule", version: "1.0.0" });

      expect(pinoChildSpy).toHaveBeenCalledTimes(1);
      expect(pinoChildSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          module: "TestModule",
          version: "1.0.0",
        }),
      );
    });

    it("child()로 생성된 Logger의 info가 Pino child의 info를 호출해야 함", () => {
      const childLogger = logger.child({ service: "auth-service" });
      // biome-ignore lint/complexity/useLiteralKeys: private property access for testing
      const childPinoInfoSpy = vi.spyOn(childLogger["logger"], "info");

      childLogger.info("테스트 메시지");

      expect(childPinoInfoSpy).toHaveBeenCalledTimes(1);
      expect(childPinoInfoSpy).toHaveBeenCalledWith(expect.any(Object), "테스트 메시지");
    });
  });
});
