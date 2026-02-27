import 'reflect-metadata';
import { Context } from '@croco/framework-context';
import type { PostHogClient } from '@croco/integrations-posthog';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PostHogFeatureManager } from '../libs/PostHogFeatureManager';

describe('PostHogFeatureManager', () => {
  let featureManager!: PostHogFeatureManager;
  let mockPostHogClient!: PostHogClient;
  let mockPostHog!: {
    isFeatureEnabled: ReturnType<typeof vi.fn>;
    getFeatureFlag: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockPostHog = {
      isFeatureEnabled: vi.fn(),
      getFeatureFlag: vi.fn(),
    };

    mockPostHogClient = {
      getClient: vi.fn().mockReturnValue(mockPostHog),
      shutdown: vi.fn(),
    } as unknown as PostHogClient;

    featureManager = new PostHogFeatureManager(mockPostHogClient);
  });

  describe('isEnabled', () => {
    it('should return true when feature flag is enabled', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(true);

      const result = await featureManager.isEnabled('new-feature');

      expect(result).toBe(true);
      expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith('new-feature', 'anonymous', expect.any(Object));
    });

    it('should return false when feature flag is disabled', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(false);

      const result = await featureManager.isEnabled('disabled-feature');

      expect(result).toBe(false);
    });

    it('should return false when feature flag returns undefined', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(undefined);

      const result = await featureManager.isEnabled('unknown-feature');

      expect(result).toBe(false);
    });

    it('should use userId from context as distinctId', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(true);

      const result = await featureManager.isEnabled('user-feature', { userId: 'user-123' });

      expect(result).toBe(true);
      expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith('user-feature', 'user-123', expect.any(Object));
    });

    it('should use groups from context', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(true);

      const result = await featureManager.isEnabled('group-feature', {
        userId: 'user-123',
        groups: { team: 'team-abc' },
      });

      expect(result).toBe(true);
      expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith(
        'group-feature',
        'user-123',
        expect.objectContaining({ groups: { team: 'team-abc' } })
      );
    });
  });

  describe('getVariant', () => {
    it('should return string variant', async () => {
      mockPostHog.getFeatureFlag.mockResolvedValue('variant-a');

      const result = await featureManager.getVariant('multivariate-flag');

      expect(result).toBe('variant-a');
    });

    it('should return boolean variant', async () => {
      mockPostHog.getFeatureFlag.mockResolvedValue(true);

      const result = await featureManager.getVariant('boolean-flag');

      expect(result).toBe(true);
    });

    it('should return object variant', async () => {
      const variantConfig = { enabled: true, percentage: 50 };
      mockPostHog.getFeatureFlag.mockResolvedValue(variantConfig);

      const result = await featureManager.getVariant('config-flag');

      expect(result).toEqual(variantConfig);
    });

    it('should return false when variant is null', async () => {
      mockPostHog.getFeatureFlag.mockResolvedValue(null);

      const result = await featureManager.getVariant('unknown-flag');

      expect(result).toBe(false);
    });

    it('should return false when variant is undefined', async () => {
      mockPostHog.getFeatureFlag.mockResolvedValue(undefined);

      const result = await featureManager.getVariant('unknown-flag');

      expect(result).toBe(false);
    });
  });

  describe('Context integration', () => {
    it('should use Context.getCurrentUser() for distinctId', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(true);

      await Context.run({ requestId: 'req-1', user: { id: 'ctx-user-123' } }, async () => {
        const result = await featureManager.isEnabled('feature');

        expect(result).toBe(true);
        expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith('feature', 'ctx-user-123', expect.any(Object));
      });
    });

    it('should use Context.getTenantId() for distinctId when no user', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(true);

      await Context.run({ requestId: 'req-1', tenantId: 'tenant-456' }, async () => {
        const result = await featureManager.isEnabled('feature');

        expect(result).toBe(true);
        expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith('feature', 'tenant:tenant-456', expect.any(Object));
      });
    });

    it('should use Context.getTenantId() for groups', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(true);

      await Context.run({ requestId: 'req-1', tenantId: 'tenant-789' }, async () => {
        const result = await featureManager.isEnabled('feature');

        expect(result).toBe(true);
        expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith(
          'feature',
          'tenant:tenant-789',
          expect.objectContaining({ groups: { tenant: 'tenant-789' } })
        );
      });
    });

    it('should fallback to anonymous when no context available', async () => {
      mockPostHog.isFeatureEnabled.mockResolvedValue(false);

      const result = await featureManager.isEnabled('feature');

      expect(result).toBe(false);
      expect(mockPostHog.isFeatureEnabled).toHaveBeenCalledWith('feature', 'anonymous', expect.any(Object));
    });
  });

  describe('error handling', () => {
    it('should propagate PostHog client errors', async () => {
      mockPostHog.isFeatureEnabled.mockRejectedValue(new Error('PostHog error'));

      await expect(featureManager.isEnabled('feature')).rejects.toThrow('PostHog error');
    });

    it('should propagate PostHog client errors in getVariant', async () => {
      mockPostHog.getFeatureFlag.mockRejectedValue(new Error('PostHog variant error'));

      await expect(featureManager.getVariant('feature')).rejects.toThrow('PostHog variant error');
    });
  });
});
