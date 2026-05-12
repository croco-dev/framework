import { vi } from "vitest";
import type {
  NotificationChannel,
  NotificationProvider,
  NotificationResult,
} from "../../libs/types";

export type MockNotificationProvider = NotificationProvider & {
  getName: ReturnType<typeof vi.fn>;
  getChannel: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
};

export const createProvider = (
  name: string,
  channel: NotificationChannel,
): MockNotificationProvider => {
  const send = vi.fn<() => Promise<NotificationResult>>().mockResolvedValue({
    success: true,
    messageId: `${name}-message`,
  });

  return {
    getName: vi.fn().mockReturnValue(name),
    getChannel: vi.fn().mockReturnValue(channel),
    send,
  };
};
