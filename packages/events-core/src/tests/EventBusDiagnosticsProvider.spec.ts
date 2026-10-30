import { beforeEach, describe, expect, it, vi } from "vitest";
import { Container } from "@croco/framework-context";
import type { DomainEvent } from "../libs/DomainEvent";
import type { EventBus } from "../libs/EventBus";
import { EventBusDiagnosticsProvider } from "../libs/diagnostics/EventBusDiagnosticsProvider";
import { EventBusConfig } from "../libs/EventBusConfig";
import { EventBusStats } from "../libs/EventBusStats";
import type { EventHandler } from "../libs/EventHandler";
import { DefaultHandlerResolver } from "../libs/HandlerResolver";

class TestHandler implements EventHandler<DomainEvent> {
  async handle(): Promise<void> {}
}

describe("EventBusDiagnosticsProvider", () => {
  beforeEach(() => {
    Container.reset();
    vi.restoreAllMocks();
    EventBusConfig.setInstance(new EventBusConfig());
    EventBusConfig.setStats(new EventBusStats());
  });

  it("should expose subscriber and disjoint publish outcome counts", async () => {
    const config = EventBusConfig.getInstance();
    const stats = EventBusConfig.getStats();

    config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
    config.setEventBus(createBus());
    await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });
    stats?.publish(false);
    stats?.publish(false);
    stats?.publish(true);
    stats?.drop();

    const health = await new EventBusDiagnosticsProvider().getHealth();

    expect(health.status).toBe("healthy");
    expect(health.details).toEqual({
      subscriberCount: 1,
      publishedCount: 2,
      failCount: 1,
      droppedPublishCount: 1,
    });
  });

  it("should reject a missing bus even with subscriptions and stats", async () => {
    EventBusConfig.getInstance().subscribe({ eventName: "TestEvent", handlerClass: TestHandler });

    expect((await new EventBusDiagnosticsProvider().getHealth()).status).toBe("unhealthy");
  });

  it.each(["missing", "throwing"])(
    "should recover after a %s resolver prevents startup",
    async (mode) => {
      const config = EventBusConfig.getInstance();
      config.setEventBus(createBus());
      config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
      const provider = new EventBusDiagnosticsProvider();

      expect((await provider.getHealth()).status).toBe("unhealthy");
      const failure = new Error("handler resolution unavailable");
      await expect(
        config.start({
          handlers: [],
          resolver:
            mode === "throwing"
              ? {
                  resolve() {
                    throw failure;
                  },
                }
              : undefined,
        }),
      ).rejects.toMatchObject(
        mode === "throwing"
          ? { message: failure.message }
          : {
              code: "events-core/handler-resolver-required",
            },
      );
      expect((await provider.getHealth()).status).toBe("unhealthy");

      await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });
      expect((await provider.getHealth()).status).toBe("healthy");
    },
  );

  it("should reject partial subscription startup and recover on retry", async () => {
    const config = EventBusConfig.getInstance();
    const bus = createBus();
    const failure = new Error("subscription unavailable");
    bus.subscribe
      .mockImplementationOnce(() => {})
      .mockImplementationOnce(() => {
        throw failure;
      });
    config.setEventBus(bus);
    config.subscribe({ eventName: "FirstEvent", handlerClass: TestHandler });
    config.subscribe({ eventName: "SecondEvent", handlerClass: TestHandler });
    const provider = new EventBusDiagnosticsProvider();

    await expect(
      config.start({ handlers: [], resolver: new DefaultHandlerResolver() }),
    ).rejects.toBe(failure);
    expect((await provider.getHealth()).status).toBe("unhealthy");

    await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });
    expect((await provider.getHealth()).status).toBe("healthy");
    expect(bus.subscribe).toHaveBeenCalledTimes(3);
  });

  it("should require the replacement bus and newly registered subscriptions to start", async () => {
    const config = EventBusConfig.getInstance();
    const provider = new EventBusDiagnosticsProvider();
    config.setEventBus(createBus());
    config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
    await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });

    config.setEventBus(createBus());
    expect((await provider.getHealth()).status).toBe("unhealthy");
    await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });
    expect((await provider.getHealth()).status).toBe("healthy");

    const pending = { eventName: "NewEvent", handlerClass: TestHandler };
    config.subscribe(pending);
    expect((await provider.getHealth()).status).toBe("unhealthy");
    config.unsubscribe(pending);
    expect((await provider.getHealth()).status).toBe("healthy");

    config.clear();
    expect((await provider.getHealth()).status).toBe("unhealthy");
  });

  it("should recognize duplicate declarations of the same started subscription", async () => {
    const config = EventBusConfig.getInstance();
    config.setEventBus(createBus());
    config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
    config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
    await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });

    expect((await new EventBusDiagnosticsProvider().getHealth()).status).toBe("healthy");
  });

  it("should preserve degraded health when a started bus has no stats", async () => {
    const config = EventBusConfig.getInstance();
    config.setEventBus(createBus());
    config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
    await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });
    vi.spyOn(EventBusConfig, "getStats").mockReturnValue(undefined);

    expect((await new EventBusDiagnosticsProvider().getHealth()).status).toBe("degraded");
  });

  it("should inspect readiness within the active application scope", async () => {
    const startedScope = Container.createScope();
    const pendingScope = Container.createScope();
    const provider = new EventBusDiagnosticsProvider();
    try {
      await startedScope.run(async () => {
        const config = EventBusConfig.getInstance();
        config.setEventBus(createBus());
        config.subscribe({ eventName: "TestEvent", handlerClass: TestHandler });
        EventBusConfig.setStats(new EventBusStats());
        await config.start({ handlers: [], resolver: new DefaultHandlerResolver() });
      });
      pendingScope.run(() => {
        EventBusConfig.getInstance().subscribe({
          eventName: "TestEvent",
          handlerClass: TestHandler,
        });
        EventBusConfig.setStats(new EventBusStats());
      });

      expect((await startedScope.run(() => provider.getHealth())).status).toBe("healthy");
      expect((await pendingScope.run(() => provider.getHealth())).status).toBe("unhealthy");
    } finally {
      startedScope.run(() => EventBusConfig.disposeCurrentScope());
      pendingScope.run(() => EventBusConfig.disposeCurrentScope());
      startedScope.dispose();
      pendingScope.dispose();
    }
  });
});

function createBus() {
  return {
    publish: vi.fn(async () => {}),
    subscribe: vi.fn<EventBus["subscribe"]>(),
    unsubscribe: vi.fn<EventBus["unsubscribe"]>(),
    clear: vi.fn(),
  } satisfies EventBus;
}
