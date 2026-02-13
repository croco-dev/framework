import type { Invitation, InvitationStatus } from './types';

export abstract class InvitationStore {
  abstract findById(id: string): Promise<Invitation | null>;
  abstract findByTokenHash(tokenHash: string): Promise<Invitation | null>;
  abstract findByTenantAndEmail(tenantId: string, email: string): Promise<Invitation | null>;
  abstract findAllByTenant(tenantId: string): Promise<Invitation[]>;
  abstract save(invitation: Invitation): Promise<Invitation>;
  abstract updateStatus(id: string, status: InvitationStatus): Promise<Invitation | null>;
}
