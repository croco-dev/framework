import { InvitationStore } from './InvitationStore';
import type { Invitation, InvitationStatus } from './types';

export class InMemoryInvitationStore extends InvitationStore {
  private readonly storage = new Map<string, Invitation>();

  async findById(id: string): Promise<Invitation | null> {
    return this.storage.get(id) ?? null;
  }

  async findByTokenHash(tokenHash: string): Promise<Invitation | null> {
    for (const invitation of this.storage.values()) {
      if (invitation.tokenHash === tokenHash) {
        return invitation;
      }
    }

    return null;
  }

  async findByTenantAndEmail(tenantId: string, email: string): Promise<Invitation | null> {
    for (const invitation of this.storage.values()) {
      if (invitation.tenantId === tenantId && invitation.email === email) {
        return invitation;
      }
    }

    return null;
  }

  async findAllByTenant(tenantId: string): Promise<Invitation[]> {
    return [...this.storage.values()].filter((invitation) => invitation.tenantId === tenantId);
  }

  async save(invitation: Invitation): Promise<Invitation> {
    this.storage.set(invitation.id, invitation);
    return invitation;
  }

  async updateStatus(id: string, status: InvitationStatus): Promise<Invitation | null> {
    const invitation = this.storage.get(id);
    if (!invitation) {
      return null;
    }

    const updated: Invitation = {
      ...invitation,
      status,
    };

    this.storage.set(id, updated);
    return updated;
  }

  async countPendingByTenant(tenantId: string, since: Date): Promise<number> {
    let count = 0;

    for (const invitation of this.storage.values()) {
      if (invitation.tenantId === tenantId && invitation.status === 'pending' && invitation.createdAt >= since) {
        count += 1;
      }
    }

    return count;
  }
}
