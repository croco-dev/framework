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
  cancelSubscription(externalSubscriptionId: string, immediate?: boolean): Promise<void>;
  resumeSubscription(externalSubscriptionId: string): Promise<void>;

  // Portal
  getCustomerPortalUrl(externalCustomerId: string): Promise<string>;
}
