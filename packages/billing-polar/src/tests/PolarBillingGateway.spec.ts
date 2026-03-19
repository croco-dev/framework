import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolarBillingGateway } from '../libs/PolarBillingGateway';
import type { PolarConfig } from '../types';

const mockGetExternal = vi.fn();
const mockCreateCustomer = vi.fn();
const mockCreateCheckout = vi.fn();
const mockRevokeSubscription = vi.fn();
const mockUpdateSubscription = vi.fn();
const mockCreateCustomerSession = vi.fn();

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};

vi.mock('@polar-sh/sdk', () => {
  class Polar {
    readonly customers = {
      getExternal: mockGetExternal,
      create: mockCreateCustomer,
    };

    readonly checkouts = {
      create: mockCreateCheckout,
    };

    readonly subscriptions = {
      revoke: mockRevokeSubscription,
      update: mockUpdateSubscription,
    };

    readonly customerSessions = {
      create: mockCreateCustomerSession,
    };

    constructor(_options: unknown) {}
  }

  return { Polar };
});

const baseConfig: PolarConfig = {
  accessToken: 'polar-token',
  environment: 'sandbox',
  webhookSecret: 'webhook-secret',
  organizationId: 'org-123',
};

const POLAR_RETRY_CONFIG = {
  strategy: 'backoff' as const,
  retryConnectionErrors: true,
  backoff: {
    initialInterval: 500,
    maxInterval: 5_000,
    exponent: 1.5,
    maxElapsedTime: 15_000,
  },
};

const POLAR_RETRY_CODES = ['429', '500', '502', '503', '504'];

function createGateway(config: PolarConfig = baseConfig): PolarBillingGateway {
  return new PolarBillingGateway(config, mockLogger as any);
}

function createNotFoundError(): Error {
  return Object.assign(new Error('Customer not found'), {
    name: 'ResourceNotFound',
    error: 'ResourceNotFound',
    status: 404,
  });
}

function createTransientLookupError(): Error {
  return Object.assign(new Error('Rate limit exceeded'), {
    name: 'ConnectionError',
    status: 429,
  });
}

function createUnexpected404Error(): Error {
  return Object.assign(new Error('Gateway timeout disguised as 404'), {
    name: 'UnexpectedClientError',
    status: 404,
  });
}

describe('PolarBillingGateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogger.debug.mockClear();
    mockLogger.info.mockClear();
    mockLogger.warn.mockClear();
    mockLogger.error.mockClear();
  });

  describe('ensureCustomer', () => {
    it('should return existing customer id when lookup succeeds', async () => {
      const gateway = createGateway();

      mockGetExternal.mockResolvedValue({ id: 'cust-existing' });

      const result = await gateway.ensureCustomer('account-1', 'test@example.com');

      expect(result).toBe('cust-existing');
      expect(mockGetExternal).toHaveBeenCalledWith(
        { externalId: 'account-1' },
        {
          retries: POLAR_RETRY_CONFIG,
          retryCodes: POLAR_RETRY_CODES,
        }
      );
      expect(mockCreateCustomer).not.toHaveBeenCalled();
    });

    it('should create a customer when lookup returns ResourceNotFound', async () => {
      const gateway = createGateway();

      mockGetExternal.mockRejectedValue(createNotFoundError());
      mockCreateCustomer.mockResolvedValue({ id: 'cust-created' });

      const result = await gateway.ensureCustomer('account-1', 'test@example.com');

      expect(result).toBe('cust-created');
      expect(mockCreateCustomer).toHaveBeenCalledWith({
        externalId: 'account-1',
        email: 'test@example.com',
        organizationId: 'org-123',
      });
    });

    it('should log warning when customer not found error is caught', async () => {
      const gateway = createGateway();

      const notFoundError = createNotFoundError();
      mockGetExternal.mockRejectedValue(notFoundError);
      mockCreateCustomer.mockResolvedValue({ id: 'cust-created' });

      await gateway.ensureCustomer('account-1', 'test@example.com');

      expect(mockLogger.info).toHaveBeenCalledWith('Customer not found, creating new customer', {
        billingAccountId: 'account-1',
      });
    });

    it('should propagate transient lookup failures instead of creating a duplicate customer', async () => {
      const gateway = createGateway();

      const error = createTransientLookupError();
      mockGetExternal.mockRejectedValue(error);

      await expect(gateway.ensureCustomer('account-1', 'test@example.com')).rejects.toBe(error);
      expect(mockCreateCustomer).not.toHaveBeenCalled();
    });

    it('should not create a customer for non-ResourceNotFound 404 lookup errors', async () => {
      const gateway = createGateway();

      const error = createUnexpected404Error();
      mockGetExternal.mockRejectedValue(error);

      await expect(gateway.ensureCustomer('account-1', 'test@example.com')).rejects.toBe(error);
      expect(mockCreateCustomer).not.toHaveBeenCalled();
    });
  });

  describe('createCheckout', () => {
    it('should create checkout after ensuring a customer exists', async () => {
      const gateway = createGateway();

      mockGetExternal.mockResolvedValue({ id: 'cust-existing' });
      mockCreateCheckout.mockResolvedValue({
        id: 'checkout-1',
        url: 'https://checkout.polar.sh/checkout-1',
      });

      const result = await gateway.createCheckout({
        billingAccountId: 'account-1',
        email: 'test@example.com',
        productId: 'prod-1',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });

      expect(result).toEqual({
        checkoutId: 'checkout-1',
        checkoutUrl: 'https://checkout.polar.sh/checkout-1',
      });
      expect(mockCreateCheckout).toHaveBeenCalledWith({
        products: ['prod-1'],
        customerId: 'cust-existing',
        successUrl: 'https://example.com/success',
        cancelUrl: 'https://example.com/cancel',
      });
    });
  });

  describe('cancelSubscription', () => {
    it('should revoke immediately when immediate is true', async () => {
      const gateway = createGateway();

      await gateway.cancelSubscription('sub-1', true);

      expect(mockRevokeSubscription).toHaveBeenCalledWith({ id: 'sub-1' });
      expect(mockUpdateSubscription).not.toHaveBeenCalled();
    });

    it('should mark cancelAtPeriodEnd when immediate is false', async () => {
      const gateway = createGateway();

      await gateway.cancelSubscription('sub-1', false);

      expect(mockUpdateSubscription).toHaveBeenCalledWith({
        id: 'sub-1',
        subscriptionUpdate: {
          cancelAtPeriodEnd: true,
        },
      });
      expect(mockRevokeSubscription).not.toHaveBeenCalled();
    });
  });

  describe('resumeSubscription', () => {
    it('should resume a subscription by clearing cancelAtPeriodEnd', async () => {
      const gateway = createGateway();

      await gateway.resumeSubscription('sub-1');

      expect(mockUpdateSubscription).toHaveBeenCalledWith({
        id: 'sub-1',
        subscriptionUpdate: {
          cancelAtPeriodEnd: false,
        },
      });
    });
  });

  describe('getCustomerPortalUrl', () => {
    it('should return the customer portal url', async () => {
      const gateway = createGateway();

      mockCreateCustomerSession.mockResolvedValue({
        customerPortalUrl: 'https://polar.sh/portal/session-1',
      });

      const result = await gateway.getCustomerPortalUrl('cust-1');

      expect(result).toBe('https://polar.sh/portal/session-1');
      expect(mockCreateCustomerSession).toHaveBeenCalledWith({ customerId: 'cust-1' });
    });
  });
});
