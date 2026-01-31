export type PolarConfig = {
  accessToken: string;
  environment: 'sandbox' | 'production';
  organizationId?: string;
  webhookSecret: string;
};

export type WebhookHandlerResult = {
  success: boolean;
  eventId?: string;
  error?: string;
};
