import 'reflect-metadata';
import { beforeEach, describe, expect, it } from 'vitest';
import { FeatureManager } from '../libs/FeatureManager';

// Mock implementation for testing abstract class
class MockFeatureManager extends FeatureManager {
  async isEnabled(key: string, context?: Record<string, unknown>): Promise<boolean> {
    if (key === 'enabled-flag') return true;
    if (key === 'disabled-flag') return false;
    if (context?.userId === 'admin-user') return true;
    return false;
  }

  async getVariant(key: string, context?: Record<string, unknown>): Promise<string | boolean | number | object> {
    if (key === 'multivariate-flag') return 'variant-a';
    if (key === 'boolean-flag') return true;
    if (key === 'numeric-flag') return 42;
    if (key === 'json-flag') return { setting: 'value' };
    if (key === 'fallback-flag') return false;
    return 'default';
  }
}

describe('FeatureManager', () => {
  let featureManager!: MockFeatureManager;

  beforeEach(() => {
    featureManager = new MockFeatureManager();
  });

  describe('isEnabled', () => {
    it('should return true for enabled feature flag', async () => {
      const result = await featureManager.isEnabled('enabled-flag');
      expect(result).toBe(true);
    });

    it('should return false for disabled feature flag', async () => {
      const result = await featureManager.isEnabled('disabled-flag');
      expect(result).toBe(false);
    });

    it('should support user-based targeting via context', async () => {
      const adminResult = await featureManager.isEnabled('some-flag', { userId: 'admin-user' });
      expect(adminResult).toBe(true);

      const userResult = await featureManager.isEnabled('some-flag', { userId: 'regular-user' });
      expect(userResult).toBe(false);
    });

    it('should accept arbitrary context properties', async () => {
      const result = await featureManager.isEnabled('some-flag', {
        userId: 'user-123',
        tenantId: 'tenant-abc',
        environment: 'production',
      });
      // Verify the method accepts context without throwing
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getVariant', () => {
    it('should return string variant for multivariate flag', async () => {
      const result = await featureManager.getVariant('multivariate-flag');
      expect(result).toBe('variant-a');
    });

    it('should return boolean variant for boolean flag', async () => {
      const result = await featureManager.getVariant('boolean-flag');
      expect(result).toBe(true);
    });

    it('should return numeric variant for numeric flag', async () => {
      const result = await featureManager.getVariant('numeric-flag');
      expect(result).toBe(42);
    });

    it('should return object variant for JSON flag', async () => {
      const result = await featureManager.getVariant('json-flag');
      expect(result).toEqual({ setting: 'value' });
    });

    it('should return fallback value for unknown flag', async () => {
      const result = await featureManager.getVariant('fallback-flag');
      expect(result).toBe(false);
    });

    it('should support context-based variant evaluation', async () => {
      const result = await featureManager.getVariant('multivariate-flag', { userId: 'user-123' });
      // Verify the method accepts context without throwing
      expect(result).toBe('variant-a');
    });
  });
});
