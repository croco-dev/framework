import 'reflect-metadata';
import { AnalyticsManager } from '@croco/analytics-core';
import { Container, Context } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { OnboardingManager } from '../libs/OnboardingManager';
import { InMemoryOnboardingStore, OnboardingStore } from '../libs/OnboardingStore';
import type { OnboardingDefinition } from '../libs/types';

describe('OnboardingManager', () => {
  let manager: OnboardingManager;
  let analytics: AnalyticsManager;
  let _store: OnboardingStore;

  const sampleDefinition: OnboardingDefinition = {
    id: 'welcome-tour',
    steps: [
      { id: 'step-1', title: 'Welcome', required: true },
      { id: 'step-2', title: 'Setup Profile', required: true },
      { id: 'step-3', title: 'Optional Step', required: false },
    ],
  };

  beforeEach(() => {
    Container.reset();

    // Mock AnalyticsManager
    const mockAnalytics = {
      capture: vi.fn(),
      identify: vi.fn(),
      group: vi.fn(),
    } as unknown as AnalyticsManager;

    Container.set(AnalyticsManager.token, mockAnalytics);
    Container.set(OnboardingStore.token, new InMemoryOnboardingStore());

    // Resolve Manager manually for unit test
    const storeInstance = Container.get(OnboardingStore.token);
    const analyticsInstance = Container.get(AnalyticsManager.token);
    manager = new OnboardingManager(storeInstance, analyticsInstance);

    // Register for any internal usage
    Container.set(OnboardingManager, manager);

    analytics = analyticsInstance;
    _store = storeInstance;

    manager.register(sampleDefinition);
  });

  it('should capture event when a step is completed', async () => {
    await Context.run({ requestId: 'req-1', user: { id: 'user-1' }, tenantId: 'tenant-1' }, async () => {
      await manager.completeStep('welcome-tour', 'step-1');

      expect(analytics.capture).toHaveBeenCalledWith(
        'onboarding_step_completed',
        expect.objectContaining({
          onboardingId: 'welcome-tour',
          stepId: 'step-1',
        })
      );
    });
  });

  it('should capture completion event when all required steps are done', async () => {
    await Context.run({ requestId: 'req-2', user: { id: 'user-1' }, tenantId: 'tenant-1' }, async () => {
      // Complete step 1
      await manager.completeStep('welcome-tour', 'step-1');
      expect(analytics.capture).not.toHaveBeenCalledWith('onboarding_completed', expect.anything());

      // Complete step 2 (Final required step)
      await manager.completeStep('welcome-tour', 'step-2');

      expect(analytics.capture).toHaveBeenCalledWith(
        'onboarding_completed',
        expect.objectContaining({
          onboardingId: 'welcome-tour',
        })
      );
    });
  });

  it('should ignore optional steps for completion calculation', async () => {
    await Context.run({ requestId: 'req-3', user: { id: 'user-2' }, tenantId: 'tenant-1' }, async () => {
      await manager.completeStep('welcome-tour', 'step-1');
      await manager.completeStep('welcome-tour', 'step-2');

      // Should be completed even if step-3 is not done
      expect(analytics.capture).toHaveBeenCalledWith('onboarding_completed', expect.anything());
    });
  });

  it('should store state per user and tenant', async () => {
    await Context.run({ requestId: 'req-4', user: { id: 'user-A' }, tenantId: 'tenant-A' }, async () => {
      await manager.completeStep('welcome-tour', 'step-1');
    });

    await Context.run({ requestId: 'req-5', user: { id: 'user-B' }, tenantId: 'tenant-A' }, async () => {
      const status = await manager.getStatus('welcome-tour');
      expect(status.steps['step-1']).toBeUndefined(); // User B should not see User A's progress
    });
  });
});
