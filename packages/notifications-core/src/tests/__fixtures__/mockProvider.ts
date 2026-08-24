import { vi } from "vitest";
import type {
  NotificationChannel,
  NotificationProvider,
  NotificationProviderCapabilities,
  NotificationResult,
} from "../../libs/types";

export type MockNotificationProvider = NotificationProvider & {
  getName: ReturnType<typeof vi.fn>;
  getChannel: ReturnType<typeof vi.fn>;
  getCapabilities: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

export const createProvider = (
  name: string,
  channel: NotificationChannel,
  capabilities: NotificationProviderCapabilities,
): MockNotificationProvider => {
  const send = vi.fn<() => Promise<NotificationResult>>().mockResolvedValue({
    success: true,
    messageId: `${name}-message`,
  });

  return {
    getName: vi.fn().mockReturnValue(name),
    getChannel: vi.fn().mockReturnValue(channel),
    getCapabilities: vi.fn().mockReturnValue(capabilities),
    send,
  };
};

export const createConsumerManagedRenderedCapabilities = (
  name: string,
  channel: NotificationChannel,
): NotificationProviderCapabilities => ({
  providerName: name,
  channels: [channel],
  supportsIdempotencyKey: false,
  supportsProviderTemplates: false,
  supportsRenderedTemplates: true,
  outboxIntegration: "consumer-managed",
});
