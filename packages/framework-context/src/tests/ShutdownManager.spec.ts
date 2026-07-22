import { ProblemCategory } from "@croco/problems-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "../libs/Container";
import { OnShutdown } from "../libs/decorators/OnShutdown";
import { type ILogger, LOGGER_TOKEN } from "../libs/ILogger";
import {
  OnShutdownDecoratorProblem,
  ShutdownConfigurationConflictProblem,
  ShutdownTimeoutProblem,
} from "../libs/problems/ShutdownProblems";
import { ShutdownManager } from "../libs/ShutdownManager";
import type { ShutdownHook } from "../libs/types";

describe("ShutdownManager", () => {
  beforeEach(() => {
    Container.reset();
    ShutdownManager.reset();
    Container.reset();
  });

  afterEach(() => {
    ShutdownManager.reset();
    Container.reset();
  });

  describe("getInstance", () => {
    it("should return singleton instance", () => {
      const instance1 = ShutdownManager.getInstance();
      const instance2 = ShutdownManager.getInstance();

      expect(instance1).toBe(instance2);
    });

    it("should return new instance after reset", () => {
      const instance1 = ShutdownManager.getInstance();
      ShutdownManager.reset();
      const instance2 = ShutdownManager.getInstance();

      expect(instance1).not.toBe(instance2);
    });

    it("should remove registered listeners when reset creates an isolated singleton", () => {
      const manager = ShutdownManager.getInstance();
      const processOffSpy = vi.spyOn(process, "off");

      manager.listen();
      ShutdownManager.reset();

      expect(processOffSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
      expect(processOffSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));

      processOffSpy.mockRestore();
    });

    it("should not route signals to a singleton replaced by reset", async () => {
      const firstManager = ShutdownManager.getInstance();
      const firstShutdownSpy = vi.spyOn(firstManager, "shutdown");
      firstManager.listen();

      ShutdownManager.reset();

      const secondManager = ShutdownManager.getInstance();
      const secondHook = { onShutdown: vi.fn(async () => {}) };
      secondManager.register(secondHook);
      secondManager.listen();

      process.emit("SIGTERM");

      await vi.waitFor(() => {
        expect(secondHook.onShutdown).toHaveBeenCalledTimes(1);
      });
      expect(firstShutdownSpy).not.toHaveBeenCalled();

      firstShutdownSpy.mockRestore();
    });

    it("should allow first explicit timeout after implicit singleton creation", async () => {
      vi.useFakeTimers();

      const mockLogger = { error: vi.fn() } as unknown as ILogger;
      Container.set(LOGGER_TOKEN, mockLogger);

      const manager = ShutdownManager.getInstance();
      ShutdownManager.getInstance(50);

      manager.register({
        onShutdown: async () => {
          await new Promise(() => {});
        },
      });

      const rejected = expect(manager.shutdown()).rejects.toThrow(
        "Shutdown timeout exceeded after 50ms",
      );

      await vi.advanceTimersByTimeAsync(50);

      await rejected;

      expect(mockLogger.error).toHaveBeenCalledWith("[ShutdownManager] Shutdown timeout exceeded.");

      vi.useRealTimers();
    });

    it("should reject conflicting explicit timeout configuration", () => {
      const manager = ShutdownManager.getInstance(100);

      expect(() => ShutdownManager.getInstance(5000)).toThrow(ShutdownConfigurationConflictProblem);
      expect(() => ShutdownManager.getInstance(5000)).toThrow(
        "ShutdownManager is already configured with timeout 100ms; received conflicting timeout 5000ms",
      );
      expect(ShutdownManager.getInstance(100)).toBe(manager);
    });
  });

  describe("configure", () => {
    it("should keep registered listeners when configuration is repeated", () => {
      const manager = ShutdownManager.getInstance(100);
      const processOnSpy = vi.spyOn(process, "on");
      const processOffSpy = vi.spyOn(process, "off");

      manager.listen();
      manager.configure(100);
      manager.listen();

      expect(processOffSpy).not.toHaveBeenCalled();
      expect(processOnSpy).toHaveBeenCalledTimes(2);

      processOnSpy.mockRestore();
      processOffSpy.mockRestore();
    });

    it("should reject conflicting configuration without releasing signal listeners", () => {
      const manager = ShutdownManager.getInstance(100);
      const processOffSpy = vi.spyOn(process, "off");

      manager.listen();

      expect(() => manager.configure(5000)).toThrow(ShutdownConfigurationConflictProblem);
      expect(processOffSpy).not.toHaveBeenCalled();

      processOffSpy.mockRestore();
    });
  });

  describe("register", () => {
    it("should register shutdown hook", () => {
      const manager = ShutdownManager.getInstance();
      const hook: ShutdownHook = {
        onShutdown: vi.fn(),
      };

      manager.register(hook);

      expect((manager as unknown as { hooks: ShutdownHook[] }).hooks).toContain(hook);
    });

    it("should not register hook during shutdown", async () => {
      const manager = ShutdownManager.getInstance();
      const hook1: ShutdownHook = {
        onShutdown: vi.fn().mockImplementation(async () => {
          const hook2: ShutdownHook = { onShutdown: vi.fn() };
          manager.register(hook2);
        }),
      };

      manager.register(hook1);
      await manager.shutdown();

      const hooks = (manager as unknown as { hooks: ShutdownHook[] }).hooks;
      expect(hooks).toHaveLength(1);
    });
  });

  describe("listen", () => {
    it("should register signal listeners", () => {
      const manager = ShutdownManager.getInstance();
      const processOnSpy = vi.spyOn(process, "on");

      manager.listen();

      expect(processOnSpy).toHaveBeenCalledWith("SIGTERM", expect.any(Function));
      expect(processOnSpy).toHaveBeenCalledWith("SIGINT", expect.any(Function));

      processOnSpy.mockRestore();
    });

    it("should not register listeners twice", () => {
      const manager = ShutdownManager.getInstance();
      const processOnSpy = vi.spyOn(process, "on");

      manager.listen();
      manager.listen();

      expect(processOnSpy).toHaveBeenCalledTimes(2);

      processOnSpy.mockRestore();
    });
  });

  describe("shutdown", () => {
    it("should execute hooks in reverse order (LIFO)", async () => {
      const manager = ShutdownManager.getInstance();
      const order: string[] = [];

      const hook1: ShutdownHook = {
        onShutdown: async () => {
          order.push("hook1");
        },
      };
      const hook2: ShutdownHook = {
        onShutdown: async () => {
          order.push("hook2");
        },
      };

      manager.register(hook1);
      manager.register(hook2);

      await manager.shutdown();

      expect(order).toEqual(["hook2", "hook1"]);
    });

    it("should continue executing hooks even if one fails", async () => {
      const mockLogger = { error: vi.fn() } as unknown as ILogger;
      Container.set(LOGGER_TOKEN, mockLogger);

      const manager = ShutdownManager.getInstance();
      const order: string[] = [];

      const hook1: ShutdownHook = {
        onShutdown: async () => {
          order.push("hook1");
        },
      };
      const hook2: ShutdownHook = {
        onShutdown: async () => {
          throw new Error("Hook failed");
        },
      };
      const hook3: ShutdownHook = {
        onShutdown: async () => {
          order.push("hook3");
        },
      };

      manager.register(hook1);
      manager.register(hook2);
      manager.register(hook3);

      await manager.shutdown();

      expect(order).toEqual(["hook3", "hook1"]);
      expect(mockLogger.error).toHaveBeenCalledWith(
        "[ShutdownManager] Hook execution failed:",
        expect.any(Error),
      );
    });

    it("should not execute shutdown twice", async () => {
      const manager = ShutdownManager.getInstance();
      const hook: ShutdownHook = {
        onShutdown: vi.fn(),
      };

      manager.register(hook);
      await manager.shutdown();
      await manager.shutdown();

      expect(hook.onShutdown).toHaveBeenCalledTimes(1);
    });

    it("should reject with timeout problem after timeout", async () => {
      vi.useFakeTimers();

      const mockLogger = { error: vi.fn() } as unknown as ILogger;
      Container.set(LOGGER_TOKEN, mockLogger);

      const manager = ShutdownManager.getInstance(100);
      const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

      const hook: ShutdownHook = {
        onShutdown: async () => {
          await new Promise(() => {});
        },
      };

      manager.register(hook);

      const shutdownPromise = manager.shutdown();
      const rejected = expect(shutdownPromise).rejects.toBeInstanceOf(ShutdownTimeoutProblem);

      await vi.advanceTimersByTimeAsync(100);

      await rejected;
      expect(mockLogger.error).toHaveBeenCalledWith("[ShutdownManager] Shutdown timeout exceeded.");
      expect(exitSpy).not.toHaveBeenCalled();

      vi.useRealTimers();
      exitSpy.mockRestore();
    });

    it("should abort active hooks when timeout is exceeded", async () => {
      vi.useFakeTimers();

      const manager = ShutdownManager.getInstance(100);
      const abortStates: boolean[] = [];

      const hook: ShutdownHook = {
        onShutdown: async (signal?: AbortSignal) => {
          signal?.addEventListener("abort", () => {
            abortStates.push(signal.aborted);
          });

          await new Promise(() => {});
        },
      };

      manager.register(hook);

      const rejected = expect(manager.shutdown()).rejects.toBeInstanceOf(ShutdownTimeoutProblem);

      await vi.advanceTimersByTimeAsync(100);

      await rejected;
      expect(abortStates).toEqual([true]);

      vi.useRealTimers();
    });
  });
});

describe("OnShutdown decorator", () => {
  beforeEach(() => {
    Container.reset();
    ShutdownManager.reset();
    Container.reset();
  });

  afterEach(() => {
    ShutdownManager.reset();
    Container.reset();
  });

  describe("as class decorator", () => {
    it("should register class implementing ShutdownHook", async () => {
      @OnShutdown()
      class MyService implements ShutdownHook {
        shutdownCalled = false;
        receivedSignal: AbortSignal | undefined;

        async onShutdown(signal?: AbortSignal): Promise<void> {
          this.shutdownCalled = true;
          this.receivedSignal = signal;
        }
      }

      Container.set(MyService, new MyService());

      const manager = ShutdownManager.getInstance();
      await manager.shutdown();

      const instance = Container.get(MyService);
      expect(instance.shutdownCalled).toBe(true);
      expect(instance.receivedSignal).toBeInstanceOf(AbortSignal);
    });
  });

  describe("as method decorator", () => {
    it("should execute the method on the registered instance with the shutdown signal", async () => {
      class MyService {
        calls = 0;
        receivedSignal: AbortSignal | undefined;

        @OnShutdown()
        async cleanup(signal?: AbortSignal): Promise<void> {
          this.calls += 1;
          this.receivedSignal = signal;
        }
      }

      const instance = new MyService();
      Container.set(MyService, instance);
      await ShutdownManager.getInstance().shutdown();

      expect(instance.calls).toBe(1);
      expect(instance.receivedSignal).toBeInstanceOf(AbortSignal);
    });

    it("should prefer the decorated method when the class is also decorated", async () => {
      @OnShutdown()
      class MyService implements ShutdownHook {
        decoratedCalls = 0;
        conventionalCalls = 0;

        @OnShutdown()
        async cleanup(): Promise<void> {
          this.decoratedCalls += 1;
        }

        async onShutdown(): Promise<void> {
          this.conventionalCalls += 1;
        }
      }

      const instance = new MyService();
      Container.set(MyService, instance);
      await ShutdownManager.getInstance().shutdown();

      expect(instance.decoratedCalls).toBe(1);
      expect(instance.conventionalCalls).toBe(0);
    });

    it.each(["class-first", "method-first"] as const)(
      "should make manual %s decorator evaluation order-independent",
      async (order) => {
        class MyService implements ShutdownHook {
          decoratedCalls = 0;
          conventionalCalls = 0;

          async cleanup(): Promise<void> {
            this.decoratedCalls += 1;
          }

          async onShutdown(): Promise<void> {
            this.conventionalCalls += 1;
          }
        }

        const classDecorator = OnShutdown() as ClassDecorator;
        const methodDecorator = OnShutdown() as MethodDecorator;
        const descriptor = Object.getOwnPropertyDescriptor(
          MyService.prototype,
          "cleanup",
        ) as PropertyDescriptor;

        if (order === "class-first") {
          classDecorator(MyService);
          methodDecorator(MyService.prototype, "cleanup", descriptor);
        } else {
          methodDecorator(MyService.prototype, "cleanup", descriptor);
          classDecorator(MyService);
        }

        const instance = new MyService();
        Container.set(MyService, instance);
        await ShutdownManager.getInstance().shutdown();

        expect(instance.decoratedCalls).toBe(1);
        expect(instance.conventionalCalls).toBe(0);
      },
    );

    it("should make repeated evaluation of the same method idempotent", async () => {
      class MyService {
        calls = 0;

        async cleanup(): Promise<void> {
          this.calls += 1;
        }
      }

      const decorator = OnShutdown() as MethodDecorator;
      const descriptor = Object.getOwnPropertyDescriptor(
        MyService.prototype,
        "cleanup",
      ) as PropertyDescriptor;
      decorator(MyService.prototype, "cleanup", descriptor);
      decorator(MyService.prototype, "cleanup", descriptor);

      const instance = new MyService();
      Container.set(MyService, instance);
      await ShutdownManager.getInstance().shutdown();

      expect(instance.calls).toBe(1);
    });

    it("should remain idempotent when the decorator module is evaluated again", async () => {
      // @ts-expect-error -- Vite query imports intentionally create independent module instances.
      const moduleA = await import("../libs/decorators/OnShutdown.ts?reload-a");
      // @ts-expect-error -- Vite query imports intentionally create independent module instances.
      const moduleB = await import("../libs/decorators/OnShutdown.ts?reload-b");

      expect(moduleA.OnShutdown).not.toBe(moduleB.OnShutdown);

      class MyService implements ShutdownHook {
        decoratedCalls = 0;
        conventionalCalls = 0;

        async cleanup(): Promise<void> {
          this.decoratedCalls += 1;
        }

        async onShutdown(): Promise<void> {
          this.conventionalCalls += 1;
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        MyService.prototype,
        "cleanup",
      ) as PropertyDescriptor;
      (moduleA.OnShutdown() as ClassDecorator)(MyService);
      (moduleB.OnShutdown() as MethodDecorator)(MyService.prototype, "cleanup", descriptor);

      const instance = new MyService();
      Container.set(MyService, instance);
      await ShutdownManager.getInstance().shutdown();

      expect(instance.decoratedCalls).toBe(1);
      expect(instance.conventionalCalls).toBe(0);
    });

    it("should register in a fresh manager after reset while retaining method metadata", async () => {
      class MyService {
        calls = 0;

        async cleanup(): Promise<void> {
          this.calls += 1;
        }
      }

      const methodDecorator = OnShutdown() as MethodDecorator;
      const classDecorator = OnShutdown() as ClassDecorator;
      const descriptor = Object.getOwnPropertyDescriptor(
        MyService.prototype,
        "cleanup",
      ) as PropertyDescriptor;
      methodDecorator(MyService.prototype, "cleanup", descriptor);
      classDecorator(MyService);

      const firstInstance = new MyService();
      Container.set(MyService, firstInstance);
      await ShutdownManager.getInstance().shutdown();
      expect(firstInstance.calls).toBe(1);

      ShutdownManager.reset();
      Container.reset();
      classDecorator(MyService);

      const secondInstance = new MyService();
      Container.set(MyService, secondInstance);
      await ShutdownManager.getInstance().shutdown();
      expect(secondInstance.calls).toBe(1);
    });

    it("should invoke the nearest inherited decorated function on the subclass instance", async () => {
      const mockLogger = { error: vi.fn() } as unknown as ILogger;

      class BaseService {
        calls: string[] = [];

        @OnShutdown()
        async cleanup(): Promise<void> {
          this.calls.push("base");
        }
      }

      @OnShutdown()
      class ChildService extends BaseService {
        override async cleanup(): Promise<void> {
          this.calls.push("child");
        }
      }

      const base = new BaseService();
      const child = new ChildService();
      Container.set(LOGGER_TOKEN, mockLogger);
      Container.set(BaseService, base);
      Container.set(ChildService, child);
      await ShutdownManager.getInstance().shutdown();

      expect(base.calls).toEqual(["base"]);
      expect(child.calls).toEqual(["base"]);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should prefer an own decorated subclass declaration", async () => {
      const mockLogger = { error: vi.fn() } as unknown as ILogger;

      class BaseService {
        calls: string[] = [];

        @OnShutdown()
        async cleanup(): Promise<void> {
          this.calls.push("base");
        }
      }

      class ChildService extends BaseService {
        @OnShutdown()
        override async cleanup(): Promise<void> {
          this.calls.push("child");
        }
      }

      const base = new BaseService();
      const child = new ChildService();
      Container.set(LOGGER_TOKEN, mockLogger);
      Container.set(BaseService, base);
      Container.set(ChildService, child);
      await ShutdownManager.getInstance().shutdown();

      expect(base.calls).toEqual(["base"]);
      expect(child.calls).toEqual(["child"]);
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it("should reject static methods with a stable diagnostic", () => {
      const manager = ShutdownManager.getInstance();
      const hooksBefore = (manager as unknown as { hooks: ShutdownHook[] }).hooks.length;
      let problem: OnShutdownDecoratorProblem | undefined;

      try {
        class MyService {
          readonly marker = "instance";

          @OnShutdown()
          static async cleanup(): Promise<void> {}
        }

        void MyService;
      } catch (error) {
        if (error instanceof OnShutdownDecoratorProblem) {
          problem = error;
        }
      }

      expect(problem).toBeInstanceOf(OnShutdownDecoratorProblem);
      expect(problem?.code).toBe("framework-context/on-shutdown-decorator-invalid");
      expect(problem?.category).toBe(ProblemCategory.ValidationError);
      expect(problem?.reason).toBe("static-method");
      expect(problem?.detail).toBe(
        "@OnShutdown() does not support static method 'MyService.cleanup'.",
      );
      expect(problem?.toJSON()).toMatchObject({
        reason: "static-method",
        targetName: "MyService",
        propertyKey: "cleanup",
      });
      expect((manager as unknown as { hooks: ShutdownHook[] }).hooks).toHaveLength(hooksBefore);
    });

    it("should reject accessors as non-method targets", () => {
      const manager = ShutdownManager.getInstance();
      const hooksBefore = (manager as unknown as { hooks: ShutdownHook[] }).hooks.length;

      class MyService {
        get cleanup(): string {
          return "cleanup";
        }
      }

      const descriptor = Object.getOwnPropertyDescriptor(
        MyService.prototype,
        "cleanup",
      ) as PropertyDescriptor;
      const decorate = (): void => {
        (OnShutdown() as MethodDecorator)(MyService.prototype, "cleanup", descriptor);
      };

      expect(decorate).toThrowError(OnShutdownDecoratorProblem);

      try {
        decorate();
      } catch (error) {
        expect(error).toMatchObject({
          code: "framework-context/on-shutdown-decorator-invalid",
          category: ProblemCategory.ValidationError,
          reason: "non-method",
          detail:
            "@OnShutdown() can decorate only classes or instance methods; received 'MyService.cleanup'.",
        });
        expect((error as OnShutdownDecoratorProblem).toJSON()).toMatchObject({
          reason: "non-method",
          targetName: "MyService",
          propertyKey: "cleanup",
        });
      }

      expect((manager as unknown as { hooks: ShutdownHook[] }).hooks).toHaveLength(hooksBefore);
    });

    it("should reject distinct decorated methods on the same class", () => {
      class MyService {
        async first(): Promise<void> {}
        async second(): Promise<void> {}
      }

      const decorator = OnShutdown() as MethodDecorator;
      decorator(
        MyService.prototype,
        "first",
        Object.getOwnPropertyDescriptor(MyService.prototype, "first") as PropertyDescriptor,
      );
      const manager = ShutdownManager.getInstance();
      const hooksBefore = (manager as unknown as { hooks: ShutdownHook[] }).hooks.length;

      expect(() =>
        decorator(
          MyService.prototype,
          "second",
          Object.getOwnPropertyDescriptor(MyService.prototype, "second") as PropertyDescriptor,
        ),
      ).toThrowError(
        expect.objectContaining({
          code: "framework-context/on-shutdown-decorator-invalid",
          category: ProblemCategory.ValidationError,
          reason: "multiple-methods",
          detail:
            "@OnShutdown() supports one instance method per class; 'MyService.second' conflicts with 'MyService.first'.",
          extensions: {
            reason: "multiple-methods",
            targetName: "MyService",
            propertyKey: "second",
            existingPropertyKey: "first",
          },
        }),
      );
      expect((manager as unknown as { hooks: ShutdownHook[] }).hooks).toHaveLength(hooksBefore);
    });
  });
});
