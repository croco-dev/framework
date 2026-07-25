import { Component, Inject, Token } from "@croco/framework-context";
import {
  type Membership,
  type MembershipCreateInput,
  type MembershipOwnerMutationInput,
  type MembershipOwnerMutationResult,
  type MembershipOwnershipTransferInput,
  type MembershipOwnershipTransferResult,
  type MembershipRole,
  MembershipStore,
} from "@croco/membership-core";
// Runtime value required for constructor metadata.
// oxlint-disable-next-line typescript/consistent-type-imports
import { TxManager } from "@croco/tx-core";
import type { DrizzleDb } from "@croco/tx-drizzle";
import { and, count, eq, inArray, sql } from "drizzle-orm";
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
   * 현재 소유자 행을 잠근 뒤 조건부 변경으로 마지막 소유자 제약을 확인하고 제거 또는 강등합니다.
   */
  async mutateOwner(input: MembershipOwnerMutationInput): Promise<MembershipOwnerMutationResult> {
    try {
      return await this.txManager.run(async () => {
        const client = this.txManager.getClient() ?? this.db;

        await client
          .select({ userId: memberships.userId })
          .from(memberships)
          .where(and(eq(memberships.tenantId, input.tenantId), eq(memberships.role, "owner")))
          .for("update");

        const canMutate = and(
          eq(memberships.tenantId, input.tenantId),
          eq(memberships.userId, input.userId),
          sql`(
            ${memberships.role} <> 'owner'
            or exists (
              select 1
              from ${memberships} as other_owner
              where other_owner.tenant_id = ${input.tenantId}
                and other_owner.role = 'owner'
                and other_owner.user_id <> ${input.userId}
            )
          )`,
        );

        let mutatedRows: MembershipRow[];
        if (input.operation === "remove") {
          mutatedRows = (await client
            .delete(memberships)
            .where(canMutate)
            .returning()) as MembershipRow[];
        } else {
          mutatedRows = (await client
            .update(memberships)
            .set({ role: input.role, updatedAt: new Date() })
            .where(canMutate)
            .returning()) as MembershipRow[];
        }

        const mutated = mutatedRows[0];
        if (mutated) {
          return { status: "applied", membership: this.mapToMembership(mutated) };
        }

        const rows = (await client
          .select()
          .from(memberships)
          .where(
            and(eq(memberships.tenantId, input.tenantId), eq(memberships.userId, input.userId)),
          )
          .limit(1)) as MembershipRow[];

        return rows[0] ? { status: "last_owner" } : { status: "not_found" };
      });
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        return { status: "conflict" };
      }
      throw error;
    }
  }

  /**
   * 두 멤버십의 역할을 하나의 조건부 UPDATE로 변경하여 소유권을 이전합니다.
   */
  async transferOwnership(
    input: MembershipOwnershipTransferInput,
  ): Promise<MembershipOwnershipTransferResult> {
    try {
      return await this.txManager.run(async () => {
        const client = this.txManager.getClient() ?? this.db;

        await client
          .select({ userId: memberships.userId })
          .from(memberships)
          .where(and(eq(memberships.tenantId, input.tenantId), eq(memberships.role, "owner")))
          .for("update");

        const existingRows = (await client
          .select()
          .from(memberships)
          .where(
            and(
              eq(memberships.tenantId, input.tenantId),
              inArray(memberships.userId, [input.fromUserId, input.toUserId]),
            ),
          )) as MembershipRow[];
        const fromMembership = existingRows.find((row) => row.userId === input.fromUserId);
        const toMembership = existingRows.find((row) => row.userId === input.toUserId);

        if (!fromMembership) {
          return { status: "not_found", userId: input.fromUserId };
        }
        if (fromMembership.role !== "owner") {
          return { status: "source_not_owner" };
        }
        if (!toMembership) {
          return { status: "not_found", userId: input.toUserId };
        }
        if (input.fromUserId === input.toUserId) {
          const membership = this.mapToMembership(fromMembership);
          return {
            status: "applied",
            fromMembership: membership,
            toMembership: membership,
            previousToRole: membership.role,
          };
        }

        const updatedRows = (await client
          .update(memberships)
          .set({
            role: sql<MembershipRole>`case
            when ${memberships.userId} = ${input.fromUserId} then 'admin'
            else 'owner'
          end`,
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(memberships.tenantId, input.tenantId),
              inArray(memberships.userId, [input.fromUserId, input.toUserId]),
              sql`(
              select source_owner.role
              from ${memberships} as source_owner
              where source_owner.tenant_id = ${input.tenantId}
                and source_owner.user_id = ${input.fromUserId}
            ) = 'owner'`,
              sql`(
              select count(*)
              from ${memberships} as transfer_member
              where transfer_member.tenant_id = ${input.tenantId}
                and transfer_member.user_id in (${input.fromUserId}, ${input.toUserId})
            ) = 2`,
            ),
          )
          .returning()) as MembershipRow[];
        const updatedFrom = updatedRows.find((row) => row.userId === input.fromUserId);
        const updatedTo = updatedRows.find((row) => row.userId === input.toUserId);

        if (!updatedFrom || !updatedTo) {
          const currentRows = (await client
            .select()
            .from(memberships)
            .where(
              and(
                eq(memberships.tenantId, input.tenantId),
                inArray(memberships.userId, [input.fromUserId, input.toUserId]),
              ),
            )) as MembershipRow[];
          const currentFrom = currentRows.find((row) => row.userId === input.fromUserId);
          const currentTo = currentRows.find((row) => row.userId === input.toUserId);
          if (!currentFrom) {
            return { status: "not_found", userId: input.fromUserId };
          }
          if (!currentTo) {
            return { status: "not_found", userId: input.toUserId };
          }
          return { status: "source_not_owner" };
        }

        return {
          status: "applied",
          fromMembership: this.mapToMembership(updatedFrom),
          toMembership: this.mapToMembership(updatedTo),
          previousToRole: toMembership.role,
        };
      });
    } catch (error) {
      if (this.isSerializationFailure(error)) {
        return { status: "conflict" };
      }
      throw error;
    }
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

  private isSerializationFailure(error: unknown): boolean {
    if (typeof error !== "object" || error === null) {
      return false;
    }
    if ("code" in error && (error as { code?: unknown }).code === "40001") {
      return true;
    }
    return "cause" in error && this.isSerializationFailure((error as { cause?: unknown }).cause);
  }
}
