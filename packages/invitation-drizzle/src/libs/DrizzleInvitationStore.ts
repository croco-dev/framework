import { Component, Inject, Token } from '@croco/framework-context';
import { type Invitation, type InvitationStatus, InvitationStore } from '@croco/invitation-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb, DrizzleInsertFn, DrizzleSelectFn, DrizzleUpdateFn } from '@croco/tx-drizzle';
import { and, eq } from 'drizzle-orm';
import { invitations } from './schema';

export type DrizzleInvitationClient = DrizzleDb & {
  select: DrizzleSelectFn;
  insert: DrizzleInsertFn;
  update: DrizzleUpdateFn;
};

export const DRIZZLE_INVITATION_TOKEN = new Token<DrizzleInvitationClient>('DRIZZLE_INVITATION_TOKEN');

@Component()
export class DrizzleInvitationStore extends InvitationStore {
  constructor(
    @Inject(DRIZZLE_INVITATION_TOKEN) private readonly db: DrizzleInvitationClient,
    private readonly txManager: TxManager<DrizzleInvitationClient>
  ) {
    super();
  }

  async findById(id: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client.select().from(invitations).where(eq(invitations.id, id)).limit(1);
    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client.select().from(invitations).where(eq(invitations.tokenHash, tokenHash)).limit(1);
    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async findByTenantAndEmail(tenantId: string, email: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client
      .select()
      .from(invitations)
      .where(and(eq(invitations.tenantId, tenantId), eq(invitations.email, email)))
      .limit(1);

    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async findAllByTenant(tenantId: string): Promise<Invitation[]> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client.select().from(invitations).where(eq(invitations.tenantId, tenantId));
    return result.map((row: typeof invitations.$inferSelect) => this.mapToInvitation(row));
  }

  async save(invitation: Invitation): Promise<Invitation> {
    const client = this.txManager.getClient() ?? this.db;

    const result = await client
      .insert(invitations)
      .values({
        id: invitation.id,
        tenantId: invitation.tenantId,
        inviterId: invitation.inviterId,
        email: invitation.email,
        tokenHash: invitation.tokenHash,
        type: invitation.type,
        role: invitation.role,
        status: invitation.status,
        expiresAt: invitation.expiresAt,
        acceptedAt: invitation.acceptedAt,
        revokedAt: invitation.revokedAt,
        createdAt: invitation.createdAt,
      })
      .onConflictDoUpdate({
        target: [invitations.id],
        set: {
          tenantId: invitation.tenantId,
          inviterId: invitation.inviterId,
          email: invitation.email,
          tokenHash: invitation.tokenHash,
          type: invitation.type,
          role: invitation.role,
          status: invitation.status,
          expiresAt: invitation.expiresAt,
          acceptedAt: invitation.acceptedAt,
          revokedAt: invitation.revokedAt,
          createdAt: invitation.createdAt,
        },
      })
      .returning();

    return this.mapToInvitation(result[0]);
  }

  async updateStatus(id: string, status: InvitationStatus): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;
    const whereClause =
      status === 'accepted' ? and(eq(invitations.id, id), eq(invitations.status, 'pending')) : eq(invitations.id, id);

    const result = await client.update(invitations).set({ status }).where(whereClause).returning();

    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  private mapToInvitation(row: typeof invitations.$inferSelect): Invitation {
    return {
      id: row.id,
      tenantId: row.tenantId,
      inviterId: row.inviterId,
      email: row.email,
      tokenHash: row.tokenHash,
      type: row.type,
      role: row.role,
      status: row.status,
      expiresAt: row.expiresAt,
      acceptedAt: row.acceptedAt,
      revokedAt: row.revokedAt,
      createdAt: row.createdAt,
    };
  }
}
