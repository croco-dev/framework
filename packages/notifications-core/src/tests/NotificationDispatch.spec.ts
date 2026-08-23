import { describe, expect, it, vi } from "vitest";
import {
  createNotificationIdempotencyKey,
  getNotificationProviderCapabilities,
} from "../libs/NotificationDispatch";
import { NotificationChannel } from "../libs/types";
import type { NotificationProvider } from "../libs/types";

describe("NotificationDispatch", () => {
  it("should use only the provider-declared capability profile", () => {
    const capabilities = {
      providerName: "explicit-provider",
      channels: [NotificationChannel.EMAIL],
      supportsIdempotencyKey: true,
      supportsProviderTemplates: true,
      supportsRenderedTemplates: false,
      outboxIntegration: "provider-managed" as const,
    };
    const getCapabilities = vi.fn().mockReturnValue(capabilities);
    const provider = {
      getName: () => "explicit-provider",
      getChannel: () => NotificationChannel.EMAIL,
      getCapabilities,
      send: async () => ({ success: true }),
    } satisfies NotificationProvider;

    expect(getNotificationProviderCapabilities(provider)).toBe(capabilities);
    expect(getCapabilities).toHaveBeenCalledTimes(1);
  });

  it("should derive deterministic idempotency keys from notification identity", () => {
    const input = {
      tenantId: "tenant-1",
      userId: "user-1",
      channel: NotificationChannel.EMAIL,
      topic: "billing.invoice-ready",
      recipient: "ada@example.com",
      semanticKey: "invoice-1",
      template: {
        id: "invoice-ready",
        version: "v1",
        locale: "en-US",
      },
    };

    expect(createNotificationIdempotencyKey(input)).toBe(createNotificationIdempotencyKey(input));
    expect(createNotificationIdempotencyKey(input)).toBe(
      "notification:tenant-1:user-1:EMAIL:billing.invoice-ready:ada%40example.com:invoice-1:invoice-ready:v1:en-US",
    );
  });
});
