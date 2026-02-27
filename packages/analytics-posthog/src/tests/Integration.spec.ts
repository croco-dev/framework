import 'reflect-metadata';
import type { AnalyticsManager } from '@croco/analytics-core';
import { Context } from '@croco/framework-context';
import { PostHogClient } from '@croco/integrations-posthog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogAnalyticsManager } from '../libs/PostHogAnalyticsManager';

// Mock PostHog Node
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

  beforeEach(() => {
    postHogClient = new PostHogClient({ apiKey: 'test-api-key' });
    analyticsManager = new PostHogAnalyticsManager(postHogClient);
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
});
