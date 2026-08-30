/**
 * Bounds process-local tracking for checkout creates whose provider outcome is ambiguous.
 */
export type PolarCheckoutRecoveryPolicy = {
  /** Maximum age from first tracking before normal provider lookup and creation resume. */
  readonly ttlMs?: number;
  /** Maximum number of ambiguous checkout operation keys retained by one gateway instance. */
  readonly capacity?: number;
};

export type PolarConfig = {
  accessToken: string;
  environment: "sandbox" | "production";
  organizationId?: string;
  webhookSecret: string;
  checkoutRecovery?: PolarCheckoutRecoveryPolicy;
};

export type WebhookHandlerResult = {
  success: boolean;
  eventId?: string;
  error?: string;
};
