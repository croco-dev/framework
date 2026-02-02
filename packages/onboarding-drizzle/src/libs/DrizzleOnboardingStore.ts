import { Component, Inject, Token } from '@croco/framework-context';
import { type OnboardingState, OnboardingStore } from '@croco/onboarding-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { and, eq } from 'drizzle-orm';
import { onboardingStates } from './schema';

// Token for Drizzle Database Instance
export const DRIZZLE_TOKEN = new Token<DrizzleDb>('DRIZZLE_TOKEN');

@Component()
export class DrizzleOnboardingStore extends OnboardingStore {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleDb,
    private readonly txManager: TxManager<DrizzleDb>
  ) {
    super();
  }

  async getState(tenantId: string, userId: string, onboardingId: string): Promise<OnboardingState | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client
      .select()
      .from(onboardingStates)
      .where(
        and(
          eq(onboardingStates.tenantId, tenantId),
          eq(onboardingStates.userId, userId),
          eq(onboardingStates.onboardingId, onboardingId)
        )
      )
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    const row = result[0];
    return {
      steps: row.steps as OnboardingState['steps'],
      isCompleted: row.isCompleted,
      completedAt: row.completedAt ?? undefined,
    };
  }

  async saveState(tenantId: string, userId: string, onboardingId: string, state: OnboardingState): Promise<void> {
    const client = this.txManager.getClient() ?? this.db;

    await client
      .insert(onboardingStates)
      .values({
        tenantId,
        userId,
        onboardingId,
        steps: state.steps,
        isCompleted: state.isCompleted,
        completedAt: state.completedAt,
      })
      .onConflictDoUpdate({
        target: [onboardingStates.tenantId, onboardingStates.userId, onboardingStates.onboardingId],
        set: {
          steps: state.steps,
          isCompleted: state.isCompleted,
          completedAt: state.completedAt,
          updatedAt: new Date(),
        },
      });
  }
}
