import { Component, Inject, Token } from '@croco/framework-context';
import {
  type Membership,
  type MembershipCreateInput,
  type MembershipRole,
  MembershipStore,
} from '@croco/membership-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { and, count, eq } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { memberships } from './schema';

type DrizzleMembershipClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

type MembershipRow = typeof memberships.$inferSelect;

export const DRIZZLE_TOKEN = new Token<DrizzleMembershipClient>('DRIZZLE_TOKEN');

export type { DrizzleMembershipClient };

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

  async findAllByTenant(tenantId: string): Promise<Membership[]> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client.select().from(memberships).where(eq(memberships.tenantId, tenantId))) as MembershipRow[];
    return rows.map((row) => this.mapToMembership(row));
  }

  async findAllByUser(userId: string): Promise<Membership[]> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client.select().from(memberships).where(eq(memberships.userId, userId))) as MembershipRow[];
    return rows.map((row) => this.mapToMembership(row));
  }

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

  async delete(tenantId: string, userId: string): Promise<void> {
    const client = this.txManager.getClient() ?? this.db;

    await client.delete(memberships).where(and(eq(memberships.tenantId, tenantId), eq(memberships.userId, userId)));
  }

  async countByRole(tenantId: string, role: MembershipRole): Promise<number> {
    const client = this.txManager.getClient() ?? this.db;

    const rows = (await client
      .select({ total: count() })
      .from(memberships)
      .where(and(eq(memberships.tenantId, tenantId), eq(memberships.role, role)))) as { total: number }[];

    return Number(rows[0]?.total ?? 0);
  }

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
