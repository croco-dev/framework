import type { DomainEvent } from "@croco/events-core";
import {
  Container,
  DEV_INSPECTOR_TOKEN,
  type RuntimeInspectorRecorder,
} from "@croco/framework-context";
import { InMemoryEventBus, type InMemoryEventBusOptions } from "../index";

/** Legacy test registrations are explicitly bound at the bus composition boundary. */
export function createTestEventBus<TEvent extends DomainEvent = DomainEvent>(
  options: InMemoryEventBusOptions = {},
): InMemoryEventBus<TEvent> {
  return new InMemoryEventBus<TEvent>({
    handlerResolver: { resolve: (handlerClass) => Container.get(handlerClass) },
    logger: { error: (...args) => console.error(...args) },
    runtimeInspector: {
      recordEvent: (event) =>
        Container.getOptional<RuntimeInspectorRecorder>(DEV_INSPECTOR_TOKEN)?.recordEvent(event),
    },
    ...options,
  });
}
