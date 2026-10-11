import { describe, expect, it, vi } from "vitest";
import { NotificationChannel } from "@croco/notifications-core";
import { ProblemCategory } from "@croco/problems-core";
import type { NotificationPayload } from "@croco/notifications-core";
import { FcmProvider, FcmDiagnosticsProvider, FcmProblem, normalizeFcmProblem } from "../index";
import type { FcmConfig, FcmFailureKind } from "../index";

const config: FcmConfig = {
  projectId: "fixture-project",
  credential: { type: "application-default" },
};
const payload = { to: "[redacted-token]", content: "body", push: { title: "Title", body: "Body" } };

describe("FcmProvider", () => {
  it.each<[FcmFailureKind, ProblemCategory]>([
    ["configuration", ProblemCategory.InternalServerError],
    ["authentication", ProblemCategory.InternalServerError],
    ["validation", ProblemCategory.ValidationError],
    ["token-invalid", ProblemCategory.ValidationError],
    ["sender-mismatch", ProblemCategory.InternalServerError],
    ["rate-limit", ProblemCategory.TooManyRequests],
    ["timeout", ProblemCategory.InternalServerError],
    ["unavailable", ProblemCategory.InternalServerError],
    ["upstream", ProblemCategory.InternalServerError],
  ])("assigns a stable code and category to %s", (kind, category) => {
    const problem = new FcmProblem(kind);
    expect(problem.code).toBe(`notifications-fcm/${kind}`);
    expect(problem.category).toBe(category);
  });

  it("maps canonical push to one Firebase send and reports provider acceptance", async () => {
    const send = vi.fn().mockResolvedValue("projects/fixture/messages/accepted");
    const provider = new FcmProvider(config, { send });
    expect(
      await provider.send(
        {
          ...payload,
          push: {
            ...payload.push,
            deepLink: "app://inbox",
            imageUrl: "https://example.test/image.png",
            data: { key: "value" },
            collapseKey: "inbox",
            ttlSeconds: 60,
            priority: "high",
          },
        },
        { idempotencyKey: "delivery-reference" },
      ),
    ).toEqual({ success: true, messageId: "projects/fixture/messages/accepted" });
    expect(send).toHaveBeenCalledExactlyOnceWith(
      "[redacted-token]",
      expect.objectContaining({
        title: "Title",
        body: "Body",
        imageUrl: "https://example.test/image.png",
        ttlSeconds: 60,
        priority: "high",
      }),
    );
    expect(provider.getName()).toBe("fcm");
    expect(provider.getChannel()).toBe(NotificationChannel.PUSH);
    expect(provider.getCapabilities().supportsIdempotencyKey).toBe(false);
  });

  it("rejects HTTP image URLs before sending without exposing the URL", async () => {
    const send = vi.fn().mockResolvedValue("accepted");
    const imageUrl = "http://example.test/private-image.png?access=secret";
    const result = await new FcmProvider(config, { send }).send({
      ...payload,
      push: { ...payload.push, imageUrl },
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.problem.code).toBe("notifications-fcm/validation");
    expect(result.problem.extensions).toMatchObject({ retryable: false, endpointInvalid: false });
    expect(JSON.stringify(result)).not.toContain(imageUrl);
    expect(send).not.toHaveBeenCalled();
  });

  it("bounds batch concurrency and preserves order under retryable failures", async () => {
    let active = 0;
    let maxActive = 0;
    const send = vi.fn(async (token: string) => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise<void>((resolve) => setTimeout(resolve, 1));
      active--;
      if (Number(token) % 2 === 0) throw { code: "messaging/quota-exceeded" };
      return `accepted-${token}`;
    });
    const provider = new FcmProvider(config, { send });
    const results = await provider.sendBatch(
      Array.from({ length: 13 }, (_, index) => ({ ...payload, to: String(index) })),
    );
    expect(maxActive).toBe(5);
    expect(send).toHaveBeenCalledTimes(13);
    expect(results).toHaveLength(13);
    results.forEach((result, index) => {
      expect(result.success).toBe(index % 2 === 1);
      if (result.success) expect(result.messageId).toBe(`accepted-${index}`);
      else expect(result.problem.extensions?.retryable).toBe(true);
    });
    expect(await provider.sendBatch([])).toEqual([]);
  });

  it("resolves opaque references only at the provider boundary", async () => {
    const send = vi.fn().mockResolvedValue("accepted");
    const resolveToken = vi.fn().mockResolvedValue("[redacted-token]");
    const provider = new FcmProvider(config, { send }, { resolveToken });
    await provider.send({ ...payload, to: "vault:endpoint-1" });
    expect(resolveToken).toHaveBeenCalledWith("vault:endpoint-1");
    expect(send.mock.calls[0][0]).toBe("[redacted-token]");
  });

  it("sanitizes token resolver failures and never calls Firebase", async () => {
    const send = vi.fn();
    const provider = new FcmProvider(
      config,
      { send },
      {
        resolveToken: async () => {
          throw new Error("secret-device-token");
        },
      },
    );
    const result = await provider.send({ ...payload, to: "vault:endpoint-1" });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result)).not.toContain("secret-device-token");
    expect(send).not.toHaveBeenCalled();
  });

  it.each([
    ["messaging/registration-token-not-registered", "token-invalid", false, true],
    ["messaging/invalid-registration-token", "token-invalid", false, true],
    ["messaging/invalid-argument", "validation", false, false],
    ["messaging/mismatched-credential", "sender-mismatch", false, false],
    ["messaging/authentication-error", "authentication", false, false],
    ["app/invalid-credential", "configuration", false, false],
    ["messaging/quota-exceeded", "rate-limit", true, false],
    ["messaging/device-message-rate-exceeded", "rate-limit", true, false],
    ["ETIMEDOUT", "timeout", true, false],
    ["messaging/server-unavailable", "unavailable", true, false],
    ["messaging/internal-error", "unavailable", true, false],
    ["unknown", "upstream", false, false],
    ["constructor", "upstream", false, false],
  ])(
    "classifies %s without leaking or retrying the request",
    async (code, kind, retryable, endpointInvalid) => {
      const send = vi.fn().mockRejectedValue({ code, message: payload.to, token: payload.to });
      const result = await new FcmProvider(config, { send }).send(payload);
      expect(result.success).toBe(false);
      if (result.success) return;
      expect(result.problem.code).toBe(`notifications-fcm/${kind}`);
      expect(result.problem.extensions).toMatchObject({ retryable, endpointInvalid });
      expect(JSON.stringify(result)).not.toContain(payload.to);
      expect(send).toHaveBeenCalledTimes(1);
    },
  );

  it.each([429, 500, 502, 503, 504])("classifies HTTP status %s as retryable", (status) => {
    expect(normalizeFcmProblem({ status }).extensions?.retryable).toBe(true);
    expect(
      normalizeFcmProblem({
        code: "messaging/unknown-error",
        httpResponse: { status, data: "secret-device-token" },
      }).extensions?.retryable,
    ).toBe(true);
  });

  it.each<NotificationPayload>([
    { ...payload, to: "" },
    { ...payload, push: undefined },
    { ...payload, push: { ...payload.push, ttlSeconds: -1 } },
    { ...payload, push: { ...payload.push, ttlSeconds: 2419201 } },
    { ...payload, push: { ...payload.push, data: { "google.reserved": "value" } } },
    {
      ...payload,
      push: { ...payload.push, deepLink: "app://inbox", data: { deepLink: "ambiguous" } },
    },
  ])("rejects invalid payload before sending", async (invalid) => {
    const send = vi.fn();
    const result = await new FcmProvider(config, { send }).send(invalid);
    expect(result.success).toBe(false);
    expect(send).not.toHaveBeenCalled();
  });

  it("rejects empty acceptance identifiers", async () => {
    const result = await new FcmProvider(config, { send: vi.fn().mockResolvedValue("") }).send(
      payload,
    );
    expect(result.success).toBe(false);
  });

  it("validates configuration without disclosing credentials", async () => {
    const invalid: FcmConfig = {
      projectId: "",
      credential: { type: "service-account", clientEmail: "private", privateKey: "secret" },
    };
    expect(() => new FcmProvider(invalid, { send: vi.fn() })).toThrow(
      "FCM configuration failed: configuration",
    );
    const health = await new FcmDiagnosticsProvider(invalid).getHealth();
    expect(health.status).toBe("unhealthy");
    expect(JSON.stringify(health)).not.toContain("secret");
  });

  it("distinguishes config validation from live readiness and sanitizes failures", async () => {
    const local = await new FcmDiagnosticsProvider(config).getHealth();
    expect(local.details?.liveCheck).toBe("not_configured");
    const readinessCheck = vi
      .fn()
      .mockRejectedValue({ code: "messaging/authentication-error", message: "secret-token" });
    const health = await new FcmDiagnosticsProvider(config, { readinessCheck }).getHealth();
    expect(health.status).toBe("unhealthy");
    expect(health.details?.liveCheck).toBe("failed");
    expect(JSON.stringify(health)).not.toContain("secret-token");
  });
});
