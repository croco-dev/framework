export type CreateCheckoutParams = {
  billingAccountId: string;
  email: string;
  productId: string;
  successUrl: string;
  cancelUrl?: string;
  /**
   * Stable identity for one logical checkout operation.
   * Gateway implementations must reconcile retries with the same key to the same provider session.
   */
  idempotencyKey: string;
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
  /**
   * Look up a previously accepted checkout without creating another provider session.
   * Used to recover ambiguous provider responses and idempotency-store commit failures.
   */
  reconcileCheckout(params: CreateCheckoutParams): Promise<CheckoutResult | null>;

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
