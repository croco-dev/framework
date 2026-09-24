import "reflect-metadata";
import { Container } from "@croco/framework-context";
import type { ILogger } from "@croco/framework-context";
import { PostHog } from "posthog-node";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostHogClient } from "../libs/PostHogClient";
import { POSTHOG_CONFIG_TOKEN, createPostHogConfig } from "../libs/PostHogConfig";
import { PostHogConfigProblem } from "../libs/problems/PostHogProblems";

vi.mock("posthog-node", () => {
  const PostHogMock = vi.fn();
  PostHogMock.prototype.capture = vi.fn();
  PostHogMock.prototype.flush = vi.fn().mockResolvedValue(undefined);
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
  type LoggerMock = ILogger & {
    child: ReturnType<typeof vi.fn>;
    warn: ReturnType<typeof vi.fn>;
  };
  let loggerMock!: LoggerMock;

  beforeEach(() => {
    Container.reset();
    vi.clearAllMocks();
    loggerMock = {
      child: vi.fn<ILogger["child"]>(),
      debug: vi.fn<ILogger["debug"]>(),
      error: vi.fn<ILogger["error"]>(),
      fatal: vi.fn<ILogger["fatal"]>(),
      info: vi.fn<ILogger["info"]>(),
      warn: vi.fn<ILogger["warn"]>(),
    };
    loggerMock.child.mockReturnValue(loggerMock);
    vi.stubEnv("POSTHOG_HOST", "https://test.posthog.com");
    client = new PostHogClient({ apiKey: "test-key" }, loggerMock);
    loggerMock.warn.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("should return underlying PostHog client", () => {
    const underlyingClient = client.getClient();
    expect(underlyingClient).not.toBeUndefined();
    expect(underlyingClient.flush).not.toBeUndefined();
    expect(underlyingClient.shutdown).not.toBeUndefined();
  });

  it("should flush queued events without shutting down the PostHog client", async () => {
    const underlyingClient = client.getClient();
    const flushSpy = vi.spyOn(underlyingClient, "flush");
    const shutdownSpy = vi.spyOn(underlyingClient, "shutdown");

    await client.flush();

    expect(flushSpy).toHaveBeenCalledOnce();
    expect(shutdownSpy).not.toHaveBeenCalled();
  });

  it("should wait for captures scheduled in the current turn before flushing", async () => {
    const underlyingClient = client.getClient();
    const queuedEvents: string[] = [];
    const sentEvents: string[] = [];
    vi.spyOn(underlyingClient, "capture").mockImplementation(({ event }) => {
      void Promise.resolve().then(() => {
        queuedEvents.push(event);
      });
    });
    vi.spyOn(underlyingClient, "flush").mockImplementation(async () => {
      sentEvents.push(...queuedEvents);
      queuedEvents.length = 0;
    });

    underlyingClient.capture({ distinctId: "user-1", event: "before-flush" });
    await client.flush();

    expect(sentEvents).toEqual(["before-flush"]);
  });

  it("should shutdown PostHog client", async () => {
    const underlyingClient = client.getClient();
    const shutdownSpy = vi.spyOn(underlyingClient, "shutdown");

    await client.shutdown();

    expect(shutdownSpy).toHaveBeenCalled();
  });

  it("should create validated configuration without registering global providers", () => {
    const config = createPostHogConfig({
      apiKey: "registered-key",
      host: "https://registered.posthog.example",
    });

    const resolved = new PostHogClient(config, loggerMock);

    expect(Container.has(POSTHOG_CONFIG_TOKEN)).toBe(false);
    expect(Container.has(PostHogClient)).toBe(false);
    expect(resolved.getClient()).not.toBeUndefined();
    expect(loggerMock.warn).not.toHaveBeenCalled();
    expect(PostHog).toHaveBeenLastCalledWith("registered-key", {
      host: "https://registered.posthog.example",
    });
  });

  it("should freeze the resolved environment host when configuration is created", () => {
    vi.stubEnv("POSTHOG_HOST", "https://registered-env.posthog.example");

    const config = createPostHogConfig({ apiKey: "registered-key" }, loggerMock);
    vi.unstubAllEnvs();
    const resolved = new PostHogClient(config, loggerMock);

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

  it("should keep independently composed client configurations isolated", () => {
    const firstConfig = createPostHogConfig({ apiKey: "first", host: "https://first.example" });
    const secondConfig = createPostHogConfig({ apiKey: "second", host: "https://second.example" });

    new PostHogClient(firstConfig);
    expect(PostHog).toHaveBeenLastCalledWith("first", { host: "https://first.example" });
    new PostHogClient(secondConfig);
    expect(PostHog).toHaveBeenLastCalledWith("second", { host: "https://second.example" });
    expect(firstConfig).toEqual({ apiKey: "first", host: "https://first.example" });
    expect(Container.has(POSTHOG_CONFIG_TOKEN)).toBe(false);
  });

  it("should construct with an environment host when no logger is supplied", () => {
    vi.stubEnv("POSTHOG_HOST", "https://bootstrap.posthog.example");

    const config = createPostHogConfig({ apiKey: "bootstrap-key" });
    const resolved = new PostHogClient(config);

    expect(resolved.getClient()).not.toBeUndefined();
    expect(PostHog).toHaveBeenLastCalledWith("bootstrap-key", {
      host: "https://bootstrap.posthog.example",
    });
  });

  it.each([
    ["apiKey", { apiKey: "", host: "https://valid.posthog.example" }],
    ["host", { apiKey: "valid-key", host: "not-a-url" }],
  ])("should reject invalid %s configuration without registering providers", (field, config) => {
    const configError = captureError(() => createPostHogConfig(config));
    expect(configError).toBeInstanceOf(PostHogConfigProblem);
    expect(configError).toMatchObject({
      code: "integrations-posthog/missing-config",
      detail: expect.stringContaining(field),
    });

    expect(Container.has(POSTHOG_CONFIG_TOKEN)).toBe(false);
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

    new PostHogClient({ apiKey: "env-key" }, loggerMock);

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

    expect(() => new PostHogClient({ apiKey: "env-key" }, loggerMock)).toThrow(
      HOST_REQUIRED_MESSAGE,
    );

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
