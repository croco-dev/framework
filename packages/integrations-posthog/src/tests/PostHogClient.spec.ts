import "reflect-metadata";
import { Container, ContainerResolutionProblem, LOGGER_TOKEN } from "@croco/framework-context";
import type { ILogger } from "@croco/framework-context";
import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostHogClient } from "../libs/PostHogClient";
import { POSTHOG_CONFIG_TOKEN, registerPostHogConfig } from "../libs/PostHogConfig";
import { PostHogConfigProblem } from "../libs/problems/PostHogProblems";

vi.mock("posthog-node", () => {
  const PostHogMock = vi.fn();
  PostHogMock.prototype.shutdown = vi.fn().mockResolvedValue(undefined);

  return {
    PostHog: PostHogMock,
  };
});

const HOST_REQUIRED_MESSAGE =
  "[PostHogClient] PostHog host is required for data residency compliance. " +
  "Set host in config or POSTHOG_HOST env var. " +
  "Default (app.posthog.com) routes data to US servers.";

function captureError(action: () => void): unknown {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to fail");
}

describe("PostHogClient", () => {
  let client!: PostHogClient;
  let loggerMock: { warn: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();
    loggerMock = { warn: vi.fn() };
    Container.set(LOGGER_TOKEN, loggerMock as unknown as ILogger);
    vi.stubEnv("POSTHOG_HOST", "https://test.posthog.com");
    client = new PostHogClient({ apiKey: "test-key" });
    loggerMock.warn.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return underlying PostHog client", () => {
    const underlyingClient = client.getClient();
    expect(underlyingClient).not.toBeUndefined();
    expect(underlyingClient.shutdown).not.toBeUndefined();
  });

  it("should shutdown PostHog client", async () => {
    const underlyingClient = client.getClient();
    const shutdownSpy = vi.spyOn(underlyingClient, "shutdown");

    await client.shutdown();

    expect(shutdownSpy).toHaveBeenCalled();
  });

  it("should resolve through Container after configuration is registered", () => {
    Container.reset();
    Container.register(PostHogClient, "singleton");
    Container.set(LOGGER_TOKEN, loggerMock as unknown as ILogger);
    const config = registerPostHogConfig({
      apiKey: "registered-key",
      host: "https://registered.posthog.example",
    });

    const resolved = Container.get(PostHogClient);

    expect(Container.get(POSTHOG_CONFIG_TOKEN)).toBe(config);
    expect(resolved).toBe(Container.get(PostHogClient));
    expect(PostHog).toHaveBeenLastCalledWith("registered-key", {
      host: "https://registered.posthog.example",
    });
  });

  it("should freeze the resolved environment host when configuration is registered", () => {
    Container.reset();
    Container.register(PostHogClient, "singleton");
    Container.set(LOGGER_TOKEN, loggerMock as unknown as ILogger);
    vi.stubEnv("POSTHOG_HOST", "https://registered-env.posthog.example");

    const config = registerPostHogConfig({ apiKey: "registered-key" });
    vi.unstubAllEnvs();
    const resolved = Container.get(PostHogClient);

    expect(config).toEqual({
      apiKey: "registered-key",
      host: "https://registered-env.posthog.example",
    });
    expect(Object.isFrozen(config)).toBe(true);
    expect(resolved.getClient()).not.toBeUndefined();
    expect(PostHog).toHaveBeenLastCalledWith("registered-key", {
      host: "https://registered-env.posthog.example",
    });
    expect(loggerMock.warn).toHaveBeenCalledOnce();
  });

  it("should resolve with an environment host when no logger is registered", () => {
    Container.reset();
    Container.register(PostHogClient, "singleton");
    vi.stubEnv("POSTHOG_HOST", "https://bootstrap.posthog.example");

    registerPostHogConfig({ apiKey: "bootstrap-key" });
    const resolved = Container.get(PostHogClient);

    expect(resolved.getClient()).not.toBeUndefined();
    expect(PostHog).toHaveBeenLastCalledWith("bootstrap-key", {
      host: "https://bootstrap.posthog.example",
    });
  });

  it("should fail with a stable DI diagnostic when configuration is not registered", () => {
    Container.reset();
    Container.register(PostHogClient, "singleton");

    const error = captureError(() => Container.get(PostHogClient));

    expect(error).toBeInstanceOf(ContainerResolutionProblem);
    expect(error).toMatchObject({
      code: "framework-context/di-resolution-failed",
      reason: "missing-provider",
    });
  });

  it.each([
    ["apiKey", { apiKey: "", host: "https://valid.posthog.example" }],
    ["host", { apiKey: "valid-key", host: "not-a-url" }],
  ])("should reject invalid %s configuration before registration", (field, config) => {
    Container.reset();

    const configError = captureError(() => registerPostHogConfig(config));
    expect(configError).toBeInstanceOf(PostHogConfigProblem);
    expect(configError).toMatchObject({
      code: "integrations-posthog/missing-config",
      detail: expect.stringContaining(field),
    });

    const resolutionError = captureError(() => Container.get(POSTHOG_CONFIG_TOKEN));
    expect(resolutionError).toMatchObject({ code: "framework-context/di-resolution-failed" });
  });

  it("should throw error when host is not provided", () => {
    vi.unstubAllEnvs();
    expect(() => new PostHogClient({ apiKey: "new-key" })).toThrow(HOST_REQUIRED_MESSAGE);
  });

  it("should create PostHog client with custom host", () => {
    new PostHogClient({
      apiKey: "custom-key",
      host: "https://custom.posthog.com",
    });

    expect(PostHog).toHaveBeenLastCalledWith("custom-key", {
      host: "https://custom.posthog.com",
    });
    expect(loggerMock.warn).not.toHaveBeenCalledWith(
      expect.stringContaining("data residency compliance"),
    );
  });

  it("should fallback to POSTHOG_HOST with a data residency warning when host is not provided", () => {
    vi.stubEnv("POSTHOG_HOST", "https://env.posthog.example");

    new PostHogClient({ apiKey: "env-key" });

    expect(PostHog).toHaveBeenLastCalledWith("env-key", {
      host: "https://env.posthog.example",
    });
    expect(loggerMock.warn).toHaveBeenCalledWith(
      "[PostHogClient] POSTHOG_HOST env var is used for PostHog host. " +
        "Set host explicitly in config to confirm data residency compliance.",
    );

    vi.unstubAllEnvs();
  });

  it("should throw error when POSTHOG_HOST is empty string", () => {
    vi.stubEnv("POSTHOG_HOST", "");

    expect(() => new PostHogClient({ apiKey: "env-key" })).toThrow(HOST_REQUIRED_MESSAGE);

    vi.unstubAllEnvs();
  });

  it("should allow multiple client instances", () => {
    const client1 = new PostHogClient({ apiKey: "key-1" });
    const client2 = new PostHogClient({ apiKey: "key-2" });

    expect(client1.getClient()).not.toBeUndefined();
    expect(client2.getClient()).not.toBeUndefined();
    expect(client1.getClient()).not.toBe(client2.getClient());
  });
});
