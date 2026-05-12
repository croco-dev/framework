import { MetadataStorage } from "@croco/framework-context";
import { beforeEach, describe, expect, it } from "vitest";
import { DomainEvent } from "../libs/DomainEvent";
import {
  EventRegistry,
  globalEventRegistry,
  REGISTERED_EVENT_KEY,
  RegisterEvent,
} from "../libs/EventRegistry";
import { DuplicateEventNameProblem } from "../libs/problems/EventsProblems";

class FirstEvent extends DomainEvent {
  static eventName = "FirstEvent";
  constructor(public readonly data: string) {
    super();
  }
}

class SecondEvent extends DomainEvent {
  static eventName = "SecondEvent";
  constructor(public readonly value: number) {
    super();
  }
}

class RenamedEventClass extends DomainEvent {
  static eventName = "stable.event_name";

  constructor(public readonly value: string) {
    super();
  }
}

class DuplicateEventNameClass extends DomainEvent {
  static eventName = "FirstEvent";

  constructor(public readonly value: string) {
    super();
  }
}

describe("EventRegistry", () => {
  let registry!: EventRegistry;

  beforeEach(() => {
    registry = new EventRegistry();
    MetadataStorage.clear();
  });

  describe("register", () => {
    it("should register event class", () => {
      registry.register(FirstEvent);

      expect(registry.has("FirstEvent")).toBe(true);
    });

    it("should support chaining", () => {
      const result = registry.register(FirstEvent).register(SecondEvent);

      expect(result).toBe(registry);
      expect(registry.has("FirstEvent")).toBe(true);
      expect(registry.has("SecondEvent")).toBe(true);
    });

    it("should use static eventName instead of class.name", () => {
      registry.register(RenamedEventClass);

      expect(registry.has("stable.event_name")).toBe(true);
      expect(registry.has("RenamedEventClass")).toBe(false);
    });

    it("should allow registering multiple events", () => {
      registry.register(FirstEvent).register(SecondEvent);

      const firstRetrieved = registry.get("FirstEvent");
      const secondRetrieved = registry.get("SecondEvent");

      expect(firstRetrieved).toBe(FirstEvent);
      expect(secondRetrieved).toBe(SecondEvent);
    });

    it("should fail fast when the same eventName is registered twice", () => {
      registry.register(FirstEvent);

      expect(() => {
        registry.register(DuplicateEventNameClass);
      }).toThrow(DuplicateEventNameProblem);

      expect(registry.get("FirstEvent")).toBe(FirstEvent);
    });
  });

  describe("get", () => {
    it("should return registered event class", () => {
      registry.register(FirstEvent);

      const retrieved = registry.get("FirstEvent");

      expect(retrieved).toBe(FirstEvent);
    });

    it("should return undefined for unknown event type", () => {
      const retrieved = registry.get("UnknownEvent");

      expect(retrieved).toBeUndefined();
    });

    it("should preserve generic type parameter", () => {
      registry.register(FirstEvent);

      const retrieved = registry.get<FirstEvent>("FirstEvent");

      expect(retrieved).toBe(FirstEvent);
    });
  });

  describe("has", () => {
    it("should return true for registered event", () => {
      registry.register(FirstEvent);

      expect(registry.has("FirstEvent")).toBe(true);
    });

    it("should return false for unregistered event", () => {
      expect(registry.has("UnknownEvent")).toBe(false);
    });
  });

  describe("getRegisteredTypes", () => {
    it("should return empty array when no events registered", () => {
      const types = registry.getRegisteredTypes();

      expect(types).toEqual([]);
    });

    it("should return all registered event types", () => {
      registry.register(FirstEvent).register(SecondEvent);

      const types = registry.getRegisteredTypes();

      expect(types).toHaveLength(2);
      expect(types).toContain("FirstEvent");
      expect(types).toContain("SecondEvent");
    });

    it("should return copy of types array", () => {
      registry.register(FirstEvent);
      const types1 = registry.getRegisteredTypes();
      const types2 = registry.getRegisteredTypes();

      expect(types1).not.toBe(types2);
      expect(types1).toEqual(types2);
    });
  });

  describe("clear", () => {
    it("should clear all registered events", () => {
      registry.register(FirstEvent).register(SecondEvent);
      expect(registry.has("FirstEvent")).toBe(true);
      expect(registry.has("SecondEvent")).toBe(true);

      registry.clear();

      expect(registry.has("FirstEvent")).toBe(false);
      expect(registry.has("SecondEvent")).toBe(false);
      expect(registry.getRegisteredTypes()).toEqual([]);
    });
  });
});

describe("RegisterEvent decorator", () => {
  beforeEach(() => {
    globalEventRegistry.clear();
    MetadataStorage.clear();
  });

  it("should register event class to global registry", () => {
    @RegisterEvent()
    class DecoratedEvent extends DomainEvent {
      static eventName = "decorated.event";

      constructor(public readonly value: string) {
        super();
      }
    }

    expect(globalEventRegistry.has("decorated.event")).toBe(false);
    expect(MetadataStorage.get<boolean>(REGISTERED_EVENT_KEY, DecoratedEvent)).toBe(true);
    expect(EventRegistry.fromMetadata().has("decorated.event")).toBe(true);
  });

  it("should keep metadata-driven registration semantics", () => {
    @RegisterEvent()
    class CustomEvent extends DomainEvent {
      static eventName = "custom.event";

      constructor(public readonly data: number) {
        super();
      }
    }

    expect(globalEventRegistry.has("custom.event")).toBe(false);
    expect(MetadataStorage.get<boolean>(REGISTERED_EVENT_KEY, CustomEvent)).toBe(true);
    expect(EventRegistry.fromMetadata([CustomEvent]).has("custom.event")).toBe(true);
  });

  it("should return the event class", () => {
    class ReturnedEvent extends DomainEvent {
      static eventName = "returned.event";

      constructor(public readonly value: string) {
        super();
      }
    }

    const decorated = RegisterEvent()(ReturnedEvent);

    expect(decorated).toBe(ReturnedEvent);
  });
});
