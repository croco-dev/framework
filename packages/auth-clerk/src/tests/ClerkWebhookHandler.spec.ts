import { verifyWebhook } from '@clerk/backend/webhooks';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ClerkWebhookHandler } from '../libs/ClerkWebhookHandler';
import type { WebhookEventHandler } from '../libs/types';

vi.mock('@clerk/backend/webhooks', () => ({
  verifyWebhook: vi.fn(),
}));

describe('ClerkWebhookHandler', () => {
  let webhookHandler!: ClerkWebhookHandler;
  let mockHandlers!: WebhookEventHandler;
  const options = { signingSecret: 'whsec_test' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHandlers = {
      'user.created': vi.fn(),
      'organization.updated': vi.fn(),
    };
    webhookHandler = new ClerkWebhookHandler(options, mockHandlers);
  });

  const createRequest = () =>
    new Request('http://localhost/webhook', {
      method: 'POST',
      body: JSON.stringify({ type: 'test' }),
    });

  it('should verify webhook signature', async () => {
    const request = createRequest();
    vi.mocked(verifyWebhook).mockResolvedValue({ type: 'user.created', data: {} } as any);

    await webhookHandler.handleWebhook(request);

    expect(verifyWebhook).toHaveBeenCalledWith(request, { signingSecret: options.signingSecret });
  });

  it('should throw error if verification fails', async () => {
    const request = createRequest();
    vi.mocked(verifyWebhook).mockRejectedValue(new Error('Invalid signature'));

    await expect(webhookHandler.handleWebhook(request)).rejects.toThrow('Webhook verification failed');
  });

  it('should call registered handler for user.created', async () => {
    const request = createRequest();
    const eventData = { id: 'user_123', email_addresses: [] };
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: 'user.created',
      data: eventData,
    } as any);

    await webhookHandler.handleWebhook(request);

    expect(mockHandlers['user.created']).toHaveBeenCalledWith(eventData);
  });

  it('should call registered handler for organization.updated', async () => {
    const request = createRequest();
    const eventData = { id: 'org_123', name: 'New Name' };
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: 'organization.updated',
      data: eventData,
    } as any);

    await webhookHandler.handleWebhook(request);

    expect(mockHandlers['organization.updated']).toHaveBeenCalledWith(eventData);
  });

  it('should ignore events with no registered handler', async () => {
    const request = createRequest();
    vi.mocked(verifyWebhook).mockResolvedValue({
      type: 'user.deleted',
      data: { id: 'user_123' },
    } as any);

    await webhookHandler.handleWebhook(request);

    // No error should be thrown, and no mock handler called
    expect(mockHandlers['user.created']).not.toHaveBeenCalled();
    expect(mockHandlers['organization.updated']).not.toHaveBeenCalled();
  });
});
