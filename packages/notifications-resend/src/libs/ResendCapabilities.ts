import {
  NotificationChannel,
  type NotificationProviderCapabilities,
} from "@croco/notifications-core";

export const RESEND_PROVIDER_CAPABILITIES: NotificationProviderCapabilities = Object.freeze({
  providerName: "resend",
  channels: Object.freeze([NotificationChannel.EMAIL]),
  supportsIdempotencyKey: true,
  supportsProviderTemplates: false,
  supportsRenderedTemplates: true,
  outboxIntegration: "consumer-managed",
});
