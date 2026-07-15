// Constructor dependencies must remain runtime values for emitted design:paramtypes metadata.
/* oxlint-disable typescript/consistent-type-imports */
import { Component, Inject, Token } from "@croco/framework-context";
import {
  type Membership,
  type MembershipCreateInput,
  type MembershipRole,
  MembershipStore,
} from "@croco/membership-core";
import { TxManager } from "@croco/tx-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { and, count, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { memberships } from "./schema";

type DrizzleMembershipClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

type MembershipRow = typeof memberships.$inferSelect;

/**
 * 멤버십 저장소용 Drizzle 클라이언트 주입 토큰입니다.
 */
export const DRIZZLE_TOKEN = new Token<DrizzleMembershipClient>("DRIZZLE_TOKEN");

/**
 * 멤버십 저장소에서 사용하는 Drizzle 클라이언트 타입입니다.
 */
export type { DrizzleMembershipClient };

/**
 * 멤버십 엔터티를 Drizzle로 저장하고 조회하는 구현체입니다.
 */
@Component()
export class DrizzleMembershipStore extends MembershipStore {
  /**
   * Drizzle 클라이언트와 트랜잭션 매니저를 받아 저장소를 초기화합니다.
   */
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleMembershipClient,
    private readonly txManager: TxManager<DrizzleMembershipClient>,
  ) {
    super();
  }

  /**
   * 테넌트와 사용자 조합으로 멤버십을 조회합니다.
   */
  async findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select()
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
      .limit(1)) as MembershipRow[];

    if (rows.length === 0) {
      return null;
    }

    return this.mapToMembership(rows[0]);
  }

  /**
   * 테넌트의 모든 멤버십을 조회합니다.
   */
  async findAllByTenant(tenantId: string): Promise<Membership[]> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select()
      .from(memberships)
      .where(eq(memberships.tenantId, tenantId))) as MembershipRow[];
    return rows.map((row) => this.mapToMembership(row));
  }

  /**
   * 사용자의 모든 멤버십을 조회합니다.
   */
  async findAllByUser(userId: string): Promise<Membership[]> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select()
      .from(memberships)
      .where(eq(memberships.userId, userId))) as MembershipRow[];
    return rows.map((row) => this.mapToMembership(row));
  }

  /**
   * 멤버십을 upsert 방식으로 저장합니다.
   */
  async save(input: MembershipCreateInput): Promise<Membership> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .insert(memberships)
      .values({
        id: input.id,
        tenantId: input.tenantId,
        userId: input.userId,
        role: input.role,
      })
      .onConflictDoUpdate({
        target: [memberships.tenantId, memberships.userId],
        set: {
          id: input.id,
          role: input.role,
          updatedAt: new Date(),
        },
      })
      .returning()) as MembershipRow[];

    return this.mapToMembership(rows[0]);
  }

  /**
   * 테넌트와 사용자 조합의 멤버십을 삭제합니다.
   */
  async delete(tenantId: string, userId: string): Promise<void> {
    const client = this.txManager.getClient() ?? this.db;

    await client
      .delete(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
  }

  /**
   * 특정 역할의 멤버 수를 반환합니다.
   */
  async countByRole(tenantId: string, role: MembershipRole): Promise<number> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select({ total: count() })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, role)))) as {
      total: number;
    }[];

    return Number(rows[0]?.total ?? 0);
  }

  /**
   * 테넌트의 전체 멤버 수를 반환합니다.
   */
  async countAll(tenantId: string): Promise<number> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select({ total: count() })
      .from(memberships)
      .where(eq(memberships.tenantId, tenantId))) as { total: number }[];

    return Number(rows[0]?.total ?? 0);
  }

  private mapToMembership(row: MembershipRow): Membership {
    return {
      id: row.id,
      tenantId: row.tenantId,
      userId: row.userId,
      role: row.role,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
