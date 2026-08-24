import { Container } from "@croco/framework-context";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NotificationProviderRegistry } from "../libs/NotificationProviderRegistry";
import {
  NotificationDefaultProviderConflictProblem,
  NotificationProviderAlreadyRegisteredProblem,
  NotificationProviderCapabilitiesMissingProblem,
  NotificationProviderCapabilityChannelMismatchProblem,
  NotificationProviderCapabilityNameMismatchProblem,
} from "../libs/problems/NotificationProblems";
import { NotificationChannel } from "../libs/types";
import type { NotificationProvider } from "../libs/types";
import {
  createConsumerManagedRenderedCapabilities,
  createProvider,
} from "./__fixtures__/mockProvider";

const createRenderedProvider = (name: string, channel: NotificationChannel) =>
  createProvider(name, channel, createConsumerManagedRenderedCapabilities(name, channel));

describe("NotificationProviderRegistry", () => {
  let registry!: NotificationProviderRegistry;

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();
    registry = new NotificationProviderRegistry();
  });

  it("should register a provider by name", () => {
    const provider = createRenderedProvider("resend", NotificationChannel.EMAIL);

    registry.registerProvider(provider);

    expect(registry.getProvider("resend")).toBe(provider);
    expect(registry.getProviderCapabilities("resend")).toEqual(provider.getCapabilities());
    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBeUndefined();
  });

  it("should register a default provider for a channel", () => {
    const provider = createRenderedProvider("resend", NotificationChannel.EMAIL);

    registry.registerProvider(provider, true);

    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBe("resend");
  });

  it("should throw when a provider name is already registered", () => {
    registry.registerProvider(createRenderedProvider("shared-provider", NotificationChannel.EMAIL));

    expect(() =>
      registry.registerProvider(createRenderedProvider("shared-provider", NotificationChannel.SMS)),
    ).toThrow(NotificationProviderAlreadyRegisteredProblem);
  });

  it("should reject a provider without an explicit capability method", () => {
    const providerWithoutCapabilities = {
      getName: () => "legacy-provider",
      getChannel: () => NotificationChannel.EMAIL,
      send: async () => ({ success: true }),
    } as unknown as NotificationProvider;

    try {
      registry.registerProvider(providerWithoutCapabilities);
      expect.fail("Expected missing provider capabilities");
    } catch (error) {
      expect(error).toBeInstanceOf(NotificationProviderCapabilitiesMissingProblem);
      expect(error).toMatchObject({
        code: "notifications-core/provider-capabilities-missing",
        extensions: {
          providerName: "legacy-provider",
          retryable: false,
        },
      });
    }
    expect(registry.getProvider("legacy-provider")).toBeUndefined();
  });

  it("should reject a provider whose capability method returns no profile", () => {
    const providerWithoutCapabilities = {
      getName: () => "empty-profile-provider",
      getChannel: () => NotificationChannel.EMAIL,
      getCapabilities: () => undefined,
      send: async () => ({ success: true }),
    } as unknown as NotificationProvider;

    try {
      registry.registerProvider(providerWithoutCapabilities);
      expect.fail("Expected missing provider capabilities");
    } catch (error) {
      expect(error).toBeInstanceOf(NotificationProviderCapabilitiesMissingProblem);
      expect(error).toMatchObject({
        code: "notifications-core/provider-capabilities-missing",
        extensions: {
          providerName: "empty-profile-provider",
          retryable: false,
        },
      });
    }
    expect(registry.getProvider("empty-profile-provider")).toBeUndefined();
    expect(registry.getProviderCapabilities("empty-profile-provider")).toBeUndefined();
  });

  it("should reject a capability profile declared for another provider", () => {
    const provider = createProvider("resend", NotificationChannel.EMAIL, {
      providerName: "another-provider",
      channels: [NotificationChannel.EMAIL],
      supportsIdempotencyKey: true,
      supportsProviderTemplates: false,
      supportsRenderedTemplates: true,
      outboxIntegration: "consumer-managed",
    });

    try {
      registry.registerProvider(provider);
      expect.fail("Expected capability provider name mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(NotificationProviderCapabilityNameMismatchProblem);
      expect(error).toMatchObject({
        code: "notifications-core/provider-capability-name-mismatch",
        extensions: {
          providerName: "resend",
          capabilityProviderName: "another-provider",
          retryable: false,
        },
      });
    }
    expect(registry.getProvider("resend")).toBeUndefined();
    expect(registry.getProviderCapabilities("resend")).toBeUndefined();
  });

  it("should reject a capability profile that omits the provider channel", () => {
    const provider = createProvider("resend", NotificationChannel.EMAIL, {
      providerName: "resend",
      channels: [NotificationChannel.SMS],
      supportsIdempotencyKey: true,
      supportsProviderTemplates: false,
      supportsRenderedTemplates: true,
      outboxIntegration: "consumer-managed",
    });

    try {
      registry.registerProvider(provider);
      expect.fail("Expected capability channel mismatch");
    } catch (error) {
      expect(error).toBeInstanceOf(NotificationProviderCapabilityChannelMismatchProblem);
      expect(error).toMatchObject({
        code: "notifications-core/provider-capability-channel-mismatch",
        extensions: {
          providerName: "resend",
          providerChannel: NotificationChannel.EMAIL,
          capabilityChannels: [NotificationChannel.SMS],
          retryable: false,
        },
      });
    }
    expect(registry.getProvider("resend")).toBeUndefined();
    expect(registry.getProviderCapabilities("resend")).toBeUndefined();
  });

  it("should retain an immutable snapshot of the validated capability profile", () => {
    const capabilities = {
      providerName: "resend",
      channels: [NotificationChannel.EMAIL],
      supportsIdempotencyKey: true,
      supportsProviderTemplates: false,
      supportsRenderedTemplates: true,
      outboxIntegration: "consumer-managed" as const,
    };
    const provider = createProvider("resend", NotificationChannel.EMAIL, capabilities);

    registry.registerProvider(provider);
    capabilities.providerName = "mutated-provider";
    capabilities.channels.push(NotificationChannel.SMS);

    const registeredCapabilities = registry.getProviderCapabilities("resend");
    expect(registeredCapabilities).toEqual({
      providerName: "resend",
      channels: [NotificationChannel.EMAIL],
      supportsIdempotencyKey: true,
      supportsProviderTemplates: false,
      supportsRenderedTemplates: true,
      outboxIntegration: "consumer-managed",
    });
    expect(Object.isFrozen(registeredCapabilities)).toBe(true);
    expect(Object.isFrozen(registeredCapabilities?.channels)).toBe(true);
    expect(provider.getCapabilities).toHaveBeenCalledTimes(1);
  });

  it("should throw when the same provider instance is registered twice", () => {
    const provider = createRenderedProvider("shared-provider", NotificationChannel.EMAIL);

    registry.registerProvider(provider);

    expect(() => registry.registerProvider(provider)).toThrow(
      NotificationProviderAlreadyRegisteredProblem,
    );
  });

  it("should throw when a default provider is already configured for the same channel", () => {
    registry.registerProvider(createRenderedProvider("resend", NotificationChannel.EMAIL), true);

    expect(() =>
      registry.registerProvider(createRenderedProvider("ses", NotificationChannel.EMAIL), true),
    ).toThrow(NotificationDefaultProviderConflictProblem);
  });

  it("should throw when an empty-name default provider is already configured for the same channel", () => {
    registry.registerProvider(createRenderedProvider("", NotificationChannel.EMAIL), true);

    expect(() =>
      registry.registerProvider(createRenderedProvider("ses", NotificationChannel.EMAIL), true),
    ).toThrow(NotificationDefaultProviderConflictProblem);
  });

  it("should throw when the same default provider is registered twice for a channel", () => {
    const provider = createRenderedProvider("resend", NotificationChannel.EMAIL);

    registry.registerProvider(provider, true);

    expect(() => registry.registerProvider(provider, true)).toThrow(
      NotificationProviderAlreadyRegisteredProblem,
    );
  });

  it("should keep registry state unchanged when default provider registration conflicts", () => {
    registry.registerProvider(createRenderedProvider("resend", NotificationChannel.EMAIL), true);

    expect(() =>
      registry.registerProvider(createRenderedProvider("ses", NotificationChannel.EMAIL), true),
    ).toThrow(NotificationDefaultProviderConflictProblem);

    expect(registry.getProvider("ses")).toBeUndefined();
    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBe("resend");
  });

  it("should allow distinct default providers for different channels", () => {
    registry.registerProvider(createRenderedProvider("resend", NotificationChannel.EMAIL), true);
    registry.registerProvider(createRenderedProvider("twilio", NotificationChannel.SMS), true);

    expect(registry.getDefaultProviderName(NotificationChannel.EMAIL)).toBe("resend");
    expect(registry.getDefaultProviderName(NotificationChannel.SMS)).toBe("twilio");
  });
});
