import type { NotificationPreferenceDecision } from "./NotificationPreferences";
import type { NotificationTemplateRef } from "./NotificationTemplates";
import type {
  NotificationChannel,
  NotificationJobPayload,
  NotificationPayload,
  NotificationProvider,
  NotificationProviderCapabilities,
} from "./types";

export type NotificationOutboxReference = {
  readonly outboxMessageId?: string;
  readonly idempotencyKey: string;
};

export type NotificationDispatchRequest = {
  readonly providerName: string;
  readonly channel: NotificationChannel;
  readonly payload: NotificationPayload;
  readonly providerCapabilities: NotificationProviderCapabilities;
  readonly idempotencyKey?: string;
  readonly outbox?: NotificationOutboxReference;
  readonly preferenceDecision?: NotificationPreferenceDecision;
  readonly template?: NotificationTemplateRef;
};

export type NotificationIdempotencyKeyInput = {
  readonly tenantId: string;
  readonly userId: string;
  readonly channel: NotificationChannel;
  readonly topic: string;
  readonly recipient: string;
  readonly semanticKey: string;
  readonly template?: NotificationTemplateRef;
};

export function getNotificationProviderCapabilities(
  provider: NotificationProvider,
): NotificationProviderCapabilities {
  return provider.getCapabilities();
}

export function createNotificationDispatchRequest(
  request: NotificationDispatchRequest,
): NotificationDispatchRequest {
  return request;
}

export function toNotificationJobPayload(
  request: NotificationDispatchRequest,
): NotificationJobPayload {
  return {
    ...request.payload,
    providerName: request.providerName,
    ...(request.idempotencyKey === undefined ? {} : { idempotencyKey: request.idempotencyKey }),
    ...(request.outbox === undefined ? {} : { outbox: request.outbox }),
    dispatchContext: {
      channel: request.channel,
      providerCapabilities: request.providerCapabilities,
      ...(request.preferenceDecision === undefined
        ? {}
        : { preferenceDecision: request.preferenceDecision }),
      ...(request.template === undefined ? {} : { template: request.template }),
    },
  };
}

export function createNotificationIdempotencyKey(input: NotificationIdempotencyKeyInput): string {
  const parts = [
    "notification",
    input.tenantId,
    input.userId,
    input.channel,
    input.topic,
    input.recipient,
    input.semanticKey,
    input.template?.id ?? "no-template",
    input.template?.version ?? "no-version",
    input.template?.locale ?? "no-locale",
  ];

  return parts.map(encodeURIComponent).join(":");
}
