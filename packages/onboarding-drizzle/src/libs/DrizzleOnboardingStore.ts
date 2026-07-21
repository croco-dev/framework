import { Component, Inject, Token } from "@croco/framework-context";
import { type OnboardingState, OnboardingStore } from "@croco/onboarding-core";
// Runtime value required for constructor metadata.
// oxlint-disable-next-line typescript/consistent-type-imports
import { TxManager } from "@croco/tx-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { onboardingStates } from "./schema";

/**
 * 온보딩 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
 */
export type DrizzleOnboardingClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

/**
 * 온보딩 상태 조회 시 반환되는 행 타입입니다.
 */
export type OnboardingStateRow = typeof onboardingStates.$inferSelect;

/**
 * 온보딩 저장소용 Drizzle 클라이언트 주입 토큰입니다.
 */
export const DRIZZLE_TOKEN = new Token<DrizzleOnboardingClient>("DRIZZLE_TOKEN");

/**
 * 온보딩 상태를 Drizzle로 저장하고 조회하는 구현체입니다.
 */
@Component()
export class DrizzleOnboardingStore extends OnboardingStore {
  /**
   * Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.
   */
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleOnboardingClient,
    private readonly txManager: TxManager<DrizzleOnboardingClient>,
  ) {
    super();
  }

  /**
   * 테넌트, 사용자, 온보딩 ID 기준으로 상태를 조회합니다.
   */
  async getState(
    tenantId: string,
    userId: string,
    onboardingId: string,
  ): Promise<OnboardingState | null> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select()
      .from(onboardingStates)
      .where(
        and(
          eq(onboardingStates.tenantId, tenantId),
          eq(onboardingStates.userId, userId),
          eq(onboardingStates.onboardingId, onboardingId),
        ),
      )
      .limit(1)) as OnboardingStateRow[];

    if (rows.length === 0) {
      return null;
    }

    const row = rows[0];
    return {
      steps: row.steps as OnboardingState["steps"],
      isCompleted: row.isCompleted,
      completedAt: row.completedAt ?? undefined,
    };
  }

  /**
   * 온보딩 상태를 upsert 방식으로 저장합니다.
   */
  async saveState(
    tenantId: string,
    userId: string,
    onboardingId: string,
    state: OnboardingState,
  ): Promise<void> {
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
