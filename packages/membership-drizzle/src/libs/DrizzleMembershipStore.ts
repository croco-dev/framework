import { Component, Inject, Token } from '@croco/framework-context';
import {
  type Membership,
  type MembershipCreateInput,
  type MembershipRole,
  MembershipStore,
} from '@croco/membership-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb, DrizzleDeleteFn, DrizzleInsertFn, DrizzleSelectFn } from '@croco/tx-drizzle';
import { and, count, eq } from 'drizzle-orm';
import { memberships } from './schema';

type DrizzleMembershipClient = DrizzleDb & {
  select: DrizzleSelectFn;
  insert: DrizzleInsertFn;
  delete: DrizzleDeleteFn;
};

export const DRIZZLE_TOKEN = new Token<DrizzleMembershipClient>('DRIZZLE_TOKEN');

@Component()
export class DrizzleMembershipStore extends MembershipStore {
  constructor(
    @Inject(DRIZZLE_TOKEN) private readonly db: DrizzleMembershipClient,
    private readonly txManager: TxManager<DrizzleMembershipClient>
  ) {
    super();
  }

  async findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client
      .select()
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.mapToMembership(result[0]);
  }

  async findAllByTenant(tenantId: string): Promise<Membership[]> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client.select().from(memberships).where(eq(memberships.tenantId, tenantId));
    return result.map((row: typeof memberships.$inferSelect) => this.mapToMembership(row));
  }

  async findAllByUser(userId: string): Promise<Membership[]> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client.select().from(memberships).where(eq(memberships.userId, userId));
    return result.map((row: typeof memberships.$inferSelect) => this.mapToMembership(row));
  }

  async save(input: MembershipCreateInput): Promise<Membership> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client
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
      .returning();

    return this.mapToMembership(result[0]);
  }

  async delete(tenantId: string, userId: string): Promise<void> {
    const client = this.txManager.getClient() ?? this.db;

    await client.delete(memberships).where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
  }

  async countByRole(tenantId: string, role: MembershipRole): Promise<number> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client
      .select({ total: count() })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, role)));

    return Number(result[0]?.total ?? 0);
  }

  private mapToMembership(row: typeof memberships.$inferSelect): Membership {
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
