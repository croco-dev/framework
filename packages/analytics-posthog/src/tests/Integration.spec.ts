import 'reflect-metadata';
import type { AnalyticsManager } from '@croco/analytics-core';
import { Context } from '@croco/framework-context';
import type { Logger } from '@croco/framework-logger';
import { PostHogClient } from '@croco/integrations-posthog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogAnalyticsManager } from '../libs/PostHogAnalyticsManager';

vi.mock('posthog-node', () => {
  const PostHogMock = vi.fn();
  PostHogMock.prototype.isFeatureEnabled = vi.fn().mockResolvedValue(true);
  PostHogMock.prototype.getFeatureFlag = vi.fn().mockResolvedValue('variant-a');
  PostHogMock.prototype.capture = vi.fn();
  PostHogMock.prototype.identify = vi.fn();
  PostHogMock.prototype.group = vi.fn();
  PostHogMock.prototype.shutdown = vi.fn();

  return {
    PostHog: PostHogMock,
  };
});

describe('PostHog Integration', () => {
  let analyticsManager!: AnalyticsManager;
  let postHogClient!: PostHogClient;
  let logger!: Pick<Logger, 'warn'>;

  beforeEach(() => {
    postHogClient = new PostHogClient({ apiKey: 'test-api-key', host: 'https://eu.posthog.com' });
    logger = {
      warn: vi.fn(),
    };
    analyticsManager = new PostHogAnalyticsManager(postHogClient, logger as Logger);
  });

  it('should resolve analytics manager', () => {
    expect(analyticsManager).toBeInstanceOf(PostHogAnalyticsManager);
  });

  it('should auto-inject context into analytics', async () => {
    const spy = vi.spyOn(postHogClient.getClient(), 'capture');

    await Context.run({ requestId: 'req-2', user: { id: 'user-456' }, tenantId: 'tenant-xyz' }, async () => {
      analyticsManager.capture('test-event');
      expect(spy).toHaveBeenCalledWith(
        expect.objectContaining({
          distinctId: 'user-456',
          groups: { tenant: 'tenant-xyz' },
          event: 'test-event',
        })
      );
    });
  });

  it('should log capture failures without throwing to callers', async () => {
    const spy = vi.spyOn(postHogClient.getClient(), 'capture').mockRejectedValueOnce(new Error('network failed'));

    expect(() => analyticsManager.capture('failed-event')).not.toThrow();

    await Promise.resolve();

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'failed-event',
      })
    );
    expect(logger.warn).toHaveBeenCalledWith('PostHog capture failed', {
      event: 'failed-event',
      error: 'network failed',
    });
  });

  it('should use request-scoped anonymous distinctId when user context is missing', async () => {
    const spy = vi.spyOn(postHogClient.getClient(), 'capture');

    await Context.run({ requestId: 'req-anon', tenantId: 'tenant-xyz' }, async () => {
      analyticsManager.capture('anonymous-event');
    });

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: 'anonymous:req-anon',
        groups: { tenant: 'tenant-xyz' },
        event: 'anonymous-event',
      })
    );
  });

  it('should generate a non-static anonymous distinctId outside Context', () => {
    const spy = vi.spyOn(postHogClient.getClient(), 'capture');

    analyticsManager.capture('anonymous-event');

    expect(spy).toHaveBeenCalledWith(
      expect.objectContaining({
        distinctId: expect.stringMatching(/^anonymous:/),
        event: 'anonymous-event',
      })
    );

    const lastCall = spy.mock.calls[spy.mock.calls.length - 1];
    const distinctId = lastCall?.[0]?.distinctId;

    expect(distinctId).not.toBe('anonymous');
  });
});
