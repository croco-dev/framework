import 'reflect-metadata';
import { AnalyticsManager } from '@croco/analytics-core';
import { FeatureManager } from '@croco/features-core';
import { Container, Context } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogAnalyticsManager } from '../libs/PostHogAnalyticsManager';
import { PostHogClientWrapper } from '../libs/PostHogClientWrapper';
import { PostHogFeatureManager } from '../libs/PostHogFeatureManager';

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
  let featureManager: FeatureManager;
  let analyticsManager: AnalyticsManager;
  let clientWrapper: PostHogClientWrapper;

  beforeEach(() => {
    Container.reset();

    // Manually construct and register instances to bypass DI complexity in unit tests
    const wrapper = new PostHogClientWrapper();
    Container.set(PostHogClientWrapper, wrapper);

    const postHogFeatureManager = new PostHogFeatureManager(wrapper);
    Container.set(PostHogFeatureManager, postHogFeatureManager);
    Container.set(FeatureManager.token, postHogFeatureManager);

    const postHogAnalyticsManager = new PostHogAnalyticsManager(wrapper);
    Container.set(PostHogAnalyticsManager, postHogAnalyticsManager);
    Container.set(AnalyticsManager.token, postHogAnalyticsManager);

    featureManager = Container.get(FeatureManager.token);
    analyticsManager = Container.get(AnalyticsManager.token);
    clientWrapper = Container.get(PostHogClientWrapper);
  });

  it('should resolve FeatureManager and AnalyticsManager', () => {
    expect(featureManager).toBeInstanceOf(PostHogFeatureManager);
    expect(analyticsManager).toBeInstanceOf(PostHogAnalyticsManager);
  });

  it('should auto-inject context into feature flags', async () => {
    const spy = vi.spyOn(clientWrapper.client, 'isFeatureEnabled');

    await Context.run({ requestId: 'req-1', user: { id: 'user-123' }, tenantId: 'tenant-abc' }, async () => {
      const isEnabled = await featureManager.isEnabled('new-feature');
      expect(isEnabled).toBe(true);
      expect(spy).toHaveBeenCalledWith(
        'new-feature',
        'user-123',
        expect.objectContaining({
          groups: { tenant: 'tenant-abc' },
        })
      );
    });
  });

  it('should auto-inject context into analytics', async () => {
    const spy = vi.spyOn(clientWrapper.client, 'capture');

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
