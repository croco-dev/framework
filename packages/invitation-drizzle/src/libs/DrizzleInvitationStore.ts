import { Component, Inject, Token } from '@croco/framework-context';
import { type Invitation, type InvitationStatus, InvitationStore } from '@croco/invitation-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { and, count, eq, gte } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { invitations } from './schema';

type DrizzleInvitationClient = DrizzleDb & NodePgDatabase<Record<string, never>>;

interface InvitationRow {
  id: string;
  tenantId: string;
  inviterId: string;
  email: string | null;
  tokenHash: string;
  type: 'email' | 'link';
  role: 'owner' | 'admin' | 'member' | 'viewer';
  status: 'pending' | 'accepted' | 'expired' | 'revoked' | 'declined';
  expiresAt: Date;
  acceptedAt: Date | null;
  revokedAt: Date | null;
  createdAt: Date;
}

export const DRIZZLE_INVITATION_TOKEN = new Token<DrizzleInvitationClient>('DRIZZLE_INVITATION_TOKEN');

export type { DrizzleInvitationClient };

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

    const result = (await client.select().from(invitations).where(eq(invitations.id, id)).limit(1)) as InvitationRow[];
    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(invitations)
      .where(eq(invitations.tokenHash, tokenHash))
      .limit(1)) as InvitationRow[];
    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async findByTenantAndEmail(tenantId: string, email: string): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(invitations)
      .where(and(eq(invitations.tenantId, tenantId), eq(invitations.email, email)))
      .limit(1)) as InvitationRow[];

    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async findAllByTenant(tenantId: string): Promise<Invitation[]> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select()
      .from(invitations)
      .where(eq(invitations.tenantId, tenantId))) as InvitationRow[];
    return result.map((row) => this.mapToInvitation(row));
  }

  async save(invitation: Invitation): Promise<Invitation> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
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
      .returning()) as InvitationRow[];

    return this.mapToInvitation(result[0]);
  }

  async updateStatus(id: string, status: InvitationStatus): Promise<Invitation | null> {
    const client = this.txManager.getClient() ?? this.db;
    const whereClause =
      status === 'accepted' ? and(eq(invitations.id, id), eq(invitations.status, 'pending')) : eq(invitations.id, id);

    const result = (await client.update(invitations).set({ status }).where(whereClause).returning()) as InvitationRow[];

    if (result.length === 0) {
      return null;
    }

    return this.mapToInvitation(result[0]);
  }

  async countPendingByTenant(tenantId: string, since: Date): Promise<number> {
    const client = this.txManager.getClient() ?? this.db;

    const result = (await client
      .select({ total: count() })
      .from(invitations)
      .where(
        and(eq(invitations.tenantId, tenantId), eq(invitations.status, 'pending'), gte(invitations.createdAt, since))
      )) as { total: number }[];

    return Number(result[0]?.total ?? 0);
  }

  private mapToInvitation(row: InvitationRow): Invitation {
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
