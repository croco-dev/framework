import { Component } from '@croco/framework-context';
import {
  NotificationChannel,
  type NotificationPayload,
  type NotificationProvider,
  type NotificationResult,
} from '@croco/notifications-core';
import { type CreateEmailOptions, Resend } from 'resend';
import { ResendNotificationProblem } from './problems/ResendNotificationProblem';

export interface ResendConfig {
  apiKey: string;
  from: string;
}

@Component()
export class ResendProvider implements NotificationProvider {
  private client: Resend;

  constructor(private config: ResendConfig) {
    this.client = new Resend(config.apiKey);
  }

  getName(): string {
    return 'resend';
  }

  getChannel(): NotificationChannel {
    return NotificationChannel.EMAIL;
  }

  async send(payload: NotificationPayload): Promise<NotificationResult> {
    try {
      const { to, subject, content } = payload;

      const emailOptions: CreateEmailOptions = {
        from: this.config.from,
        to,
        subject: subject || 'No Subject',
        html: content,
      };

      const data = await this.client.emails.send(emailOptions);

      if (data.error) {
        return {
          success: false,
          error: new ResendNotificationProblem(data.error.message),
          providerResponse: data,
        };
      }

      return {
        success: true,
        messageId: data.data?.id,
        providerResponse: data,
      };
    } catch (error: unknown) {
      const cause = error instanceof Error ? error : new Error(String(error));

      return {
        success: false,
        error: new ResendNotificationProblem(cause.message, cause),
      };
    }
  }
}
