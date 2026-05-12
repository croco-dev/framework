import { beforeEach, describe, expect, it } from "vitest";
import { DomainEvent } from "../libs/DomainEvent";
import type { EventHandler, EventHandlerClass } from "../libs/EventHandler";
import { DefaultHandlerResolver } from "../libs/HandlerResolver";

class TestEvent extends DomainEvent {
  static eventName = "TestEvent";
  constructor(public readonly data: string) {
    super();
  }
}

class TestHandler implements EventHandler<TestEvent> {
  public callCount = 0;

  async handle(event: TestEvent): Promise<void> {
    this.callCount++;
    expect(event.data).toBe("test");
  }
}

class FailingHandler implements EventHandler<TestEvent> {
  async handle(): Promise<void> {
    throw new Error("Handler execution failed");
  }
}

describe("DefaultHandlerResolver", () => {
  let resolver!: DefaultHandlerResolver;

  beforeEach(() => {
    resolver = new DefaultHandlerResolver();
  });

  describe("resolve", () => {
    it("should create new instance of handler class", () => {
      const handler = resolver.resolve(TestHandler as EventHandlerClass);

      expect(handler).toBeInstanceOf(TestHandler);
    });

    it("should return handler instance", () => {
      const handler = resolver.resolve(TestHandler as EventHandlerClass);

      expect(handler.handle).not.toBeUndefined();
      expect(typeof handler.handle).toBe("function");
    });

    it("should create independent instances on each call", () => {
      const handler1 = resolver.resolve(TestHandler as EventHandlerClass);
      const handler2 = resolver.resolve(TestHandler as EventHandlerClass);

      expect(handler1).not.toBe(handler2);
    });

    it("should support handlers with constructor arguments", () => {
      class HandlerWithArgs implements EventHandler<TestEvent> {
        constructor(public readonly value: number) {}

        async handle(): Promise<void> {
          expect(this.value).toBe(42);
        }
      }

      const handler = resolver.resolve(HandlerWithArgs as EventHandlerClass);

      expect(handler).toBeInstanceOf(HandlerWithArgs);
    });

    it("should preserve handler methods", async () => {
      const handler = resolver.resolve(TestHandler as EventHandlerClass);

      const event = new TestEvent("test");
      await handler.handle(event);

      expect((handler as TestHandler).callCount).toBe(1);
    });

    it("should handle async handler methods", async () => {
      let handlerExecuted = false;

      class AsyncHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {
          await new Promise((resolve) => setTimeout(resolve, 10));
          handlerExecuted = true;
        }
      }

      const handler = resolver.resolve(AsyncHandler as EventHandlerClass);

      await handler.handle(new TestEvent("async"));

      expect(handlerExecuted).toBe(true);
    });
  });

  describe("handler execution", () => {
    it("should execute handler successfully", async () => {
      const handler = resolver.resolve(TestHandler as EventHandlerClass);

      const event = new TestEvent("test");

      await expect(handler.handle(event)).resolves.toBeUndefined();
    });

    it("should propagate handler errors", async () => {
      const handler = resolver.resolve(FailingHandler as EventHandlerClass);

      await expect(handler.handle(new TestEvent("error"))).rejects.toThrow(
        "Handler execution failed",
      );
    });
  });

  describe("type safety", () => {
    it("should handle handlers for different event types", () => {
      class OtherEvent extends DomainEvent {
        constructor(public readonly value: number) {
          super();
        }
      }

      class OtherHandler implements EventHandler<OtherEvent> {
        async handle(event: OtherEvent): Promise<void> {
          expect(event.value).toBe(123);
        }
      }

      const handler = resolver.resolve(OtherHandler as EventHandlerClass);

      expect(handler).toBeInstanceOf(OtherHandler);
    });

    it("should support generic event handlers", () => {
      class GenericHandler implements EventHandler<DomainEvent> {
        async handle(event: DomainEvent): Promise<void> {
          expect(event.eventName).not.toBeUndefined();
        }
      }

      const handler = resolver.resolve(GenericHandler as EventHandlerClass);

      expect(handler).toBeInstanceOf(GenericHandler);
    });
  });

  describe("edge cases", () => {
    it("should handle handler class with no constructor", () => {
      class NoConstructorHandler implements EventHandler<TestEvent> {
        async handle(): Promise<void> {}
      }

      const handler = resolver.resolve(NoConstructorHandler as EventHandlerClass);

      expect(handler).toBeInstanceOf(NoConstructorHandler);
    });

    it("should handle handler class with multiple constructor parameters", () => {
      class MultiParamHandler implements EventHandler<TestEvent> {
        constructor(
          public readonly a: string,
          public readonly b: number,
          public readonly c: boolean,
        ) {}

        async handle(): Promise<void> {
          expect(this.a).toBe("test");
          expect(this.b).toBe(42);
          expect(this.c).toBe(true);
        }
      }

      const handler = resolver.resolve(MultiParamHandler as EventHandlerClass);

      expect(handler).toBeInstanceOf(MultiParamHandler);
    });
  });
});
