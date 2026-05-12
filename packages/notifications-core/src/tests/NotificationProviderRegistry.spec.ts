import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProviderRegistry } from "../libs/NotificationProviderRegistry";
import {
  NotificationDefaultProviderConflictProblem,
  NotificationProviderAlreadyRegisteredProblem,
} from "../libs/problems/NotificationProblems";
import { NotificationChannel } from "../libs/types";
import { createProvider } from "./__fixtures__/mockProvider";

describe("NotificationProviderRegistry", () => {
  let registry!: NotificationProviderRegistry;

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();
    registry = new NotificationProviderRegistry();
  });

  it("should register a provider by name", () => {
    const provider = createProvider("resend", NotificationChannel.EMAIL);

    registry.registerProvider(provider);

    expect(registry.getProvider("resend")).toBe(provider);
    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBeUndefined();
  });

  it("should register a default provider for a channel", () => {
    const provider = createProvider("resend", NotificationChannel.EMAIL);

    registry.registerProvider(provider, true);

    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBe("resend");
  });

  it("should throw when a provider name is already registered", () => {
    registry.registerProvider(createProvider("shared-provider", NotificationChannel.EMAIL));

    expect(() =>
      registry.registerProvider(createProvider("shared-provider", NotificationChannel.SMS)),
    ).toThrow(NotificationProviderAlreadyRegisteredProblem);
  });

  it("should throw when the same provider instance is registered twice", () => {
    const provider = createProvider("shared-provider", NotificationChannel.EMAIL);

    registry.registerProvider(provider);

    expect(() => registry.registerProvider(provider)).toThrow(
      NotificationProviderAlreadyRegisteredProblem,
    );
  });

  it("should throw when a default provider is already configured for the same channel", () => {
    registry.registerProvider(createProvider("resend", NotificationChannel.EMAIL), true);

    expect(() =>
      registry.registerProvider(createProvider("ses", NotificationChannel.EMAIL), true),
    ).toThrow(NotificationDefaultProviderConflictProblem);
  });

  it("should throw when an empty-name default provider is already configured for the same channel", () => {
    registry.registerProvider(createProvider("", NotificationChannel.EMAIL), true);

    expect(() =>
      registry.registerProvider(createProvider("ses", NotificationChannel.EMAIL), true),
    ).toThrow(NotificationDefaultProviderConflictProblem);
  });

  it("should throw when the same default provider is registered twice for a channel", () => {
    const provider = createProvider("resend", NotificationChannel.EMAIL);

    registry.registerProvider(provider, true);

    expect(() => registry.registerProvider(provider, true)).toThrow(
      NotificationProviderAlreadyRegisteredProblem,
    );
  });

  it("should keep registry state unchanged when default provider registration conflicts", () => {
    registry.registerProvider(createProvider("resend", NotificationChannel.EMAIL), true);

    expect(() =>
      registry.registerProvider(createProvider("ses", NotificationChannel.EMAIL), true),
    ).toThrow(NotificationDefaultProviderConflictProblem);

    expect(registry.getProvider("ses")).toBeUndefined();
    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBe("resend");
  });

  it("should allow distinct default providers for different channels", () => {
    registry.registerProvider(createProvider("resend", NotificationChannel.EMAIL), true);
    registry.registerProvider(createProvider("twilio", NotificationChannel.SMS), true);

    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBe("resend");
    expect(registry.getDefaultProviderName(NotificationChannel.SMS)).toBe("twilio");
  });
});
