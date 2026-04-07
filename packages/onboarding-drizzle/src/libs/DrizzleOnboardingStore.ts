import { Component, Inject, Token } from '@croco/framework-context';
import { type OnboardingState, OnboardingStore } from '@croco/onboarding-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { and, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { onboardingStates } from './schema';

export type DrizzleOnboardingClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

export type OnboardingStateRow = typeof onboardingStates.$inferSelect;

export const DRIZZLE_TOKEN = new Token<DrizzleOnboardingClient>('DRIZZLE_TOKEN');

@Component()
export class DrizzleOnboardingStore extends OnboardingStore {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleOnboardingClient,
    private readonly txManager: TxManager<DrizzleOnboardingClient>
  ) {
    super();
  }

  async getState(tenantId: string, userId: string, onboardingId: string): Promise<OnboardingState | null> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select()
      .from(onboardingStates)
      .where(
        and(
          eq(onboardingStates.tenantId, tenantId),
          eq(onboardingStates.userId, userId),
          eq(onboardingStates.onboardingId, onboardingId)
        )
      )
      .limit(1)) as OnboardingStateRow[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
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
