export enum NotificationChannel {
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  SLACK = 'SLACK',
  IN_APP = 'IN_APP',
}

export interface NotificationPayload {
  to: string;
  subject?: string;
  content: string; // HTML or Text
  metadata?: Record<string, unknown>;
  templateId?: string;
  variables?: Record<string, unknown>;
}

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  providerResponse?: unknown;
  error?: Error;
}

export interface NotificationProvider {
  /**
   * Send a notification via this provider
   */
  send(payload: NotificationPayload): Promise<NotificationResult>;

  /**
   * Get the channel this provider supports
   */
  getChannel(): NotificationChannel;

  /**
   * Provider identifier (e.g., 'resend', 'twilio')
   */
  getName(): string;
}

export interface NotificationJobPayload extends NotificationPayload {
  providerName: string;
}
