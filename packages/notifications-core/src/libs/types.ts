export enum NotificationChannel {
  EMAIL = "EMAIL",
  SMS = "SMS",
  PUSH = "PUSH",
  SLACK = "SLACK",
  IN_APP = "IN_APP",
}

export interface NotificationPayload {
  to: string;
  subject?: string;
  content: string; // HTML or Text
  metadata?: Record<string, unknown>;
  templateId?: string;
  templateVersion?: string;
  locale?: string;
  variables?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  providerResponse?: unknown;
  error?: Error;
}

export type NotificationSendOptions = {
  idempotencyKey?: string;
};

export type NotificationProviderOutboxIntegration =
  | "consumer-managed"
  | "provider-managed"
  | "unsupported";

export type NotificationProviderCapabilities = {
  readonly providerName: string;
  readonly channels: readonly NotificationChannel[];
  readonly supportsIdempotencyKey: boolean;
  readonly supportsProviderTemplates: boolean;
  readonly supportsRenderedTemplates: boolean;
  readonly outboxIntegration: NotificationProviderOutboxIntegration;
};

export interface NotificationProvider {
  /**
   * Send a notification via this provider
   */
  send(
    payload: NotificationPayload,
    options?: NotificationSendOptions,
  ): Promise<NotificationResult>;

  /**
   * Get the channel this provider supports
   */
  getChannel(): NotificationChannel;

  /**
   * Provider identifier (e.g., 'resend', 'twilio')
   */
  getName(): string;

  /**
   * Provider capability contract used by the dispatch layer.
   */
  getCapabilities(): NotificationProviderCapabilities;
}

export interface NotificationJobPayload extends NotificationPayload {
  providerName: string;
  idempotencyKey?: string;
  outbox?: {
    outboxMessageId?: string;
    idempotencyKey: string;
  };
  dispatchContext?: {
    channel: NotificationChannel;
    providerCapabilities: NotificationProviderCapabilities;
    preferenceDecision?: {
      allowed: boolean;
      context: {
        tenantId: string;
        userId: string;
        channel: NotificationChannel;
        topic: string;
      };
      reason: string;
      ruleId?: string;
      evaluationKey: string;
    };
    template?: {
      id: string;
      version: string;
      locale: string;
    };
  };
}
