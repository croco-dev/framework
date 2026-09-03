import type { ShutdownHook } from "@croco/framework-context";
import { EventBusDrainIncompleteProblem } from "./problems/EventsProblems";
import type { EventBusShutdownOptions, EventBusShutdownResult } from "./EventBusLifecycleTypes";

export type {
  EventBusActiveHandler,
  EventBusShutdownOptions,
  EventBusShutdownResult,
} from "./EventBusLifecycleTypes";

export const DEFAULT_EVENT_BUS_DRAIN_TIMEOUT_MS = 10_000;
export const MAX_EVENT_BUS_DRAIN_TIMEOUT_MS = 2_147_483_647;

/** Optional lifecycle capability for EventBus implementations that can close intake and drain work. */
export interface EventBusLifecycle {
  shutdown(options?: EventBusShutdownOptions): Promise<EventBusShutdownResult>;
}

/** Adapts an EventBus lifecycle to framework-context's shutdown hook contract. */
export function createEventBusShutdownHook(
  lifecycle: EventBusLifecycle,
  options: Pick<EventBusShutdownOptions, "timeoutMs"> = {},
): ShutdownHook {
  return {
    onShutdown: async (signal?: AbortSignal): Promise<void> => {
      const result = await lifecycle.shutdown(
        signal === undefined ? options : { ...options, signal },
      );
      if (result.status !== "drained") {
        throw new EventBusDrainIncompleteProblem(result.status, result.unfinishedHandlers);
      }
    },
  };
}
