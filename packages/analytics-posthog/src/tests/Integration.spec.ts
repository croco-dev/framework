import "reflect-metadata";
import type { AnalyticsManager } from "@croco/analytics-core";
import { Container, Context, LOGGER_TOKEN } from "@croco/framework-context";
import type { Logger } from "@croco/framework-logger";
import { PostHogClient } from "@croco/integrations-posthog";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PostHogAnalyticsDiagnosticsProvider } from "../libs/PostHogAnalyticsDiagnosticsProvider";
import {
  POSTHOG_ANALYTICS_MANAGER_OPTIONS,
  PostHogAnalyticsManager,
} from "../libs/PostHogAnalyticsManager";
import { PostHogAnalyticsFlushProblem } from "../libs/problems/PostHogAnalyticsProblems";

vi.mock("posthog-node", () => {
  const PostHogMock = vi.fn();
  PostHogMock.prototype.isFeatureEnabled = vi.fn().mockResolvedValue(true);
  PostHogMock.prototype.getFeatureFlag = vi.fn().mockResolvedValue("variant-a");
  PostHogMock.prototype.capture = vi.fn();
  PostHogMock.prototype.identify = vi.fn();
  PostHogMock.prototype.groupIdentify = vi.fn();
  PostHogMock.prototype.shutdown = vi.fn().mockResolvedValue(undefined);

  return {
    PostHog: PostHogMock,
  };
});

describe("PostHog Integration", () => {
  let analyticsManager!: AnalyticsManager;
  let postHogClient!: PostHogClient;
  let logger!: Pick<Logger, "info" | "warn">;

  beforeEach(() => {
    vi.clearAllMocks();
    postHogClient = new PostHogClient({ apiKey: "test-api-key", host: "https://eu.posthog.com" });
    logger = {
      info: vi.fn(),
      warn: vi.fn(),
    };
    Container.set(LOGGER_TOKEN, logger as Logger);
    analyticsManager = new PostHogAnalyticsManager(postHogClient);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Container.remove(PostHogAnalyticsManager);
    Container.remove(PostHogClient);
    Container.remove(LOGGER_TOKEN);
    Container.remove(POSTHOG_ANALYTICS_MANAGER_OPTIONS);
  });

  it("should resolve analytics manager", () => {
    expect(analyticsManager).toBeInstanceOf(PostHogAnalyticsManager);
  });

  it("should resolve analytics manager through the Croco container", () => {
    Container.set(PostHogClient, postHogClient);
    Container.set(LOGGER_TOKEN, logger as Logger);
    Container.register(PostHogAnalyticsManager, "singleton");

    const resolved = Container.get(PostHogAnalyticsManager);

    expect(resolved).toBeInstanceOf(PostHogAnalyticsManager);
    resolved.capture("di-event", { userId: "user-di" });
    expect(postHogClient.getClient().capture).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "user-di",
        event: "di-event",
      }),
    );
  });

  it("should auto-inject context into analytics", async () => {
    const spy = vi.spyOn(postHogClient.getClient(), "capture");

    await Context.run(
      { requestId: "req-2", user: { id: "user-456" }, tenantId: "tenant-xyz" },
      async () => {
        analyticsManager.capture("test-event");
        expect(spy).toHaveBeenCalledWith(
          expect.objectContaining({
            distinctId: "user-456",
            groups: { tenant: "tenant-xyz" },
            event: "test-event",
          }),
        );
      },
    );
  });

  it("should log capture failures without throwing to callers", async () => {
    const spy = vi
      .spyOn(postHogClient.getClient(), "capture")
      .mockRejectedValueOnce(new Error("network failed"));

    expect(() => analyticsManager.capture("failed-event")).not.toThrow();

    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "failed-event",
      }),
    );
    expect(logger.warn).toHaveBeenCalledWith("PostHog capture failed", {
      event: "failed-event",
      errorName: "Error",
      problemCode: "analytics-posthog/capture-failed",
    });
  });

  it("should not leak PostHog secrets when logging capture failures", async () => {
    const secretError = Object.assign(
      new Error("Authorization: Bearer secret ph_secret should not be logged"),
      {
        code: "ECONNRESET",
        status: 503,
      },
    );
    vi.spyOn(postHogClient.getClient(), "capture").mockRejectedValueOnce(secretError);

    analyticsManager.capture("redacted-capture-event");

    await Promise.resolve();

    expect(logger.warn).toHaveBeenCalledWith("PostHog capture failed", {
      event: "redacted-capture-event",
      errorName: "Error",
      upstreamCode: "ECONNRESET",
      upstreamStatus: 503,
      problemCode: "analytics-posthog/capture-failed",
    });
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("ph_secret");
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("Bearer secret");
  });

  it("should use request-scoped anonymous distinctId when user context is missing", async () => {
    const spy = vi.spyOn(postHogClient.getClient(), "capture");

    await Context.run({ requestId: "req-anon", tenantId: "tenant-xyz" }, async () => {
      analyticsManager.capture("anonymous-event");
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: "anonymous:req-anon",
        groups: { tenant: "tenant-xyz" },
        event: "anonymous-event",
      }),
    );
  });

  it("should generate a non-static anonymous distinctId outside Context", () => {
    const spy = vi.spyOn(postHogClient.getClient(), "capture");

    analyticsManager.capture("anonymous-event");

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: expect.stringMatching(/^anonymous:/),
        event: "anonymous-event",
      }),
    );

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    const distinctId = lastCall?.[0]?.distinctId;

    expect(distinctId).not.toBe("anonymous");
  });

  it("should identify users and associate groups through the PostHog client", () => {
    const client = postHogClient.getClient();
    const identifySpy = vi.spyOn(client, "identify");
    const groupSpy = vi.spyOn(client, "groupIdentify");

    analyticsManager.identify("user-123", { plan: "pro" });
    analyticsManager.group("tenant", "tenant-123", { seats: 10 });

    expect(identifySpy).toHaveBeenCalledWith({
      distinctId: "user-123",
      properties: { plan: "pro" },
    });
    expect(groupSpy).toHaveBeenCalledWith({
      groupType: "tenant",
      groupKey: "tenant-123",
      properties: { seats: 10 },
    });
  });

  it("should flush buffered PostHog events through shutdown", async () => {
    const shutdownSpy = vi.spyOn(postHogClient.getClient(), "shutdown");

    await analyticsManager.flush();

    expect(shutdownSpy).toHaveBeenCalledTimes(1);
  });

  it("should surface flush failures as typed Problems", async () => {
    vi.spyOn(postHogClient.getClient(), "shutdown").mockRejectedValueOnce(
      new Error("flush failed"),
    );

    await expect(analyticsManager.flush()).rejects.toBeInstanceOf(PostHogAnalyticsFlushProblem);
    expect(logger.warn).toHaveBeenCalledWith("PostHog analytics flush failed", {
      errorName: "Error",
      problemCode: "analytics-posthog/flush-failed",
    });
  });

  it("should not leak PostHog secrets when logging flush failures", async () => {
    const secretError = Object.assign(
      new Error("POSTHOG_API_KEY=ph_secret Authorization: Bearer secret"),
      {
        code: "ETIMEDOUT",
        statusCode: 504,
      },
    );
    vi.spyOn(postHogClient.getClient(), "shutdown").mockRejectedValueOnce(secretError);

    await expect(analyticsManager.flush()).rejects.toBeInstanceOf(PostHogAnalyticsFlushProblem);

    expect(logger.warn).toHaveBeenCalledWith("PostHog analytics flush failed", {
      errorName: "Error",
      upstreamCode: "ETIMEDOUT",
      upstreamStatus: 504,
      problemCode: "analytics-posthog/flush-failed",
    });
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("ph_secret");
    expect(JSON.stringify(vi.mocked(logger.warn).mock.calls)).not.toContain("Bearer secret");
  });

  it("should skip capture identify group and flush when analytics is disabled", async () => {
    Container.set(POSTHOG_ANALYTICS_MANAGER_OPTIONS, { enabled: false });
    const disabledManager = new PostHogAnalyticsManager(postHogClient);
    const client = postHogClient.getClient();
    const captureSpy = vi.spyOn(client, "capture");
    const identifySpy = vi.spyOn(client, "identify");
    const groupSpy = vi.spyOn(client, "groupIdentify");
    const shutdownSpy = vi.spyOn(client, "shutdown");

    disabledManager.capture("disabled-event", { userId: "user-1" });
    disabledManager.identify("user-1", { plan: "pro" });
    disabledManager.group("tenant", "tenant-1");
    await disabledManager.flush();

    expect(captureSpy).not.toHaveBeenCalled();
    expect(identifySpy).not.toHaveBeenCalled();
    expect(groupSpy).not.toHaveBeenCalled();
    expect(shutdownSpy).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      "PostHog analytics operation skipped because analytics is disabled",
      expect.objectContaining({
        provider: "posthog",
        operation: "capture",
        event: "disabled-event",
      }),
    );
    expect(logger.info).toHaveBeenCalledWith(
      "PostHog analytics operation skipped because analytics is disabled",
      {
        provider: "posthog",
        operation: "identify",
      },
    );
    expect(logger.info).toHaveBeenCalledWith(
      "PostHog analytics operation skipped because analytics is disabled",
      {
        provider: "posthog",
        operation: "group",
        groupType: "tenant",
      },
    );
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain("user-1");
    expect(JSON.stringify(vi.mocked(logger.info).mock.calls)).not.toContain("tenant-1");
  });

  it("should report unhealthy diagnostics for missing PostHog configuration without leaking tokens", async () => {
    vi.unstubAllEnvs();
    const diagnostics = new PostHogAnalyticsDiagnosticsProvider({ apiKey: "ph_secret" });

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("unhealthy");
    expect(health.details).toEqual(
      expect.objectContaining({
        hasApiKey: true,
        hasHost: false,
        hostSource: "missing",
        liveCheck: "not_started",
        problemCode: "integrations-posthog/missing-config",
      }),
    );
    expect(JSON.stringify(health)).not.toContain("ph_secret");
  });

  it("should report disabled diagnostics without requiring credentials", async () => {
    vi.unstubAllEnvs();
    const diagnostics = new PostHogAnalyticsDiagnosticsProvider(
      {},
      {
        enabled: false,
      },
    );

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("degraded");
    expect(health.details).toEqual(
      expect.objectContaining({
        enabled: false,
        hasApiKey: false,
        hasHost: false,
        liveCheck: "disabled",
      }),
    );
  });

  it("should sanitize readiness details and avoid exposing PostHog API keys", async () => {
    const readinessCheck = vi.fn().mockResolvedValue({
      message: "ready",
      details: {
        authorization: "Bearer secret",
        nested: {
          apiKey: "ph_secret",
          region: "eu",
        },
      },
    });
    const diagnostics = new PostHogAnalyticsDiagnosticsProvider(
      {
        apiKey: "ph_secret",
        host: "https://eu.posthog.com",
      },
      {
        readinessCheck,
      },
    );

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("healthy");
    expect(health.details).toEqual(
      expect.objectContaining({
        hasApiKey: true,
        hasHost: true,
        liveCheck: "passed",
        readiness: {
          authorization: "[redacted]",
          nested: {
            apiKey: "[redacted]",
            region: "eu",
          },
        },
      }),
    );
    expect(JSON.stringify(health)).not.toContain("ph_secret");
    expect(readinessCheck).toHaveBeenCalledWith(
      expect.objectContaining({
        config: {
          apiKey: "ph_secret",
          host: "https://eu.posthog.com",
        },
      }),
    );
  });

  it("should report provider readiness failures as degraded Problem evidence", async () => {
    const readinessError = Object.assign(new Error("upstream unavailable"), {
      code: "ECONNRESET",
      status: 503,
    });
    const diagnostics = new PostHogAnalyticsDiagnosticsProvider(
      {
        apiKey: "ph_secret",
        host: "https://eu.posthog.com",
      },
      {
        readinessCheck: async () => {
          throw readinessError;
        },
      },
    );

    const health = await diagnostics.getHealth();

    expect(health.status).toBe("degraded");
    expect(health.details).toEqual(
      expect.objectContaining({
        liveCheck: "failed",
        problemCode: "analytics-posthog/readiness-failed",
        upstreamCode: "ECONNRESET",
        upstreamStatus: 503,
      }),
    );
    expect(JSON.stringify(health)).not.toContain("ph_secret");
  });

  it("should preserve zero upstream status in readiness failure evidence", async () => {
    const readinessError = Object.assign(new Error("upstream status unavailable"), {
      code: "UNKNOWN",
      status: 0,
    });
    const diagnostics = new PostHogAnalyticsDiagnosticsProvider(
      {
        apiKey: "ph_secret",
        host: "https://eu.posthog.com",
      },
      {
        readinessCheck: async () => {
          throw readinessError;
        },
      },
    );

    const health = await diagnostics.getHealth();

    expect(health.details).toEqual(
      expect.objectContaining({
        problemCode: "analytics-posthog/readiness-failed",
        upstreamCode: "UNKNOWN",
        upstreamStatus: 0,
      }),
    );
  });
});
