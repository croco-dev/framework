import type { ShutdownHook } from "@croco/framework-context";
import { describe, expect, it, vi } from "vitest";
import {
  createEventBusShutdownHook,
  EventBusDrainIncompleteProblem,
  type EventBusLifecycle,
  type EventBusShutdownResult,
} from "../index";

describe("EventBusLifecycle", () => {
  it("adapts a drained lifecycle to a framework shutdown hook", async () => {
    const shutdown = vi.fn<EventBusLifecycle["shutdown"]>().mockResolvedValue({
      status: "drained",
      unfinishedHandlers: [],
    });
    const lifecycle: EventBusLifecycle = { shutdown };
    const hook: ShutdownHook = createEventBusShutdownHook(lifecycle, { timeoutMs: 250 });
    const controller = new AbortController();

    await hook.onShutdown(controller.signal);

    expect(shutdown).toHaveBeenCalledWith({
      signal: controller.signal,
      timeoutMs: 250,
    });
  });

  it.each(["timed-out", "cancelled"] as const)(
    "rejects a framework shutdown hook when the event bus drain is %s",
    async (status) => {
      const result: EventBusShutdownResult = {
        status,
        unfinishedHandlers: [
          {
            eventName: "order.created",
            handlerName: "ProjectOrder",
            startTime: 1_000,
          },
        ],
      };
      const lifecycle: EventBusLifecycle = {
        shutdown: vi.fn().mockResolvedValue(result),
      };
      const hook = createEventBusShutdownHook(lifecycle);
      const rejection = hook.onShutdown();

      await expect(rejection).rejects.toMatchObject({
        code: "events-core/event-bus-drain-incomplete",
        drainStatus: status,
        unfinishedHandlers: result.unfinishedHandlers,
      });
      await expect(rejection).rejects.toBeInstanceOf(EventBusDrainIncompleteProblem);
    },
  );
});
