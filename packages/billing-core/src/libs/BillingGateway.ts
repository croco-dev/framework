export type CreateCheckoutParams = {
  billingAccountId: string;
  email: string;
  productId: string;
  successUrl: string;
  cancelUrl?: string;
};

export type CheckoutResult = {
  checkoutUrl: string;
  checkoutId: string;
};

export type BillingLifecycleGatewayOptions = {
  readonly idempotencyKey: string;
};

/**
 * Abstract interface for billing provider operations.
 * Implementations: PolarBillingGateway
 */
export interface BillingGateway {
  // Customer
  ensureCustomer(billingAccountId: string, email: string): Promise<string>;

  // Checkout
  createCheckout(params: CreateCheckoutParams): Promise<CheckoutResult>;

  // Subscription
  cancelSubscription(
    externalSubscriptionId: string,
    immediate: boolean,
    options: BillingLifecycleGatewayOptions,
  ): Promise<void>;
  resumeSubscription(
    externalSubscriptionId: string,
    options: BillingLifecycleGatewayOptions,
  ): Promise<void>;

  // Portal
  getCustomerPortalUrl(externalCustomerId: string): Promise<string>;
}
