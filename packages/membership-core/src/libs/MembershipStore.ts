import type { Membership, MembershipRole } from './types';

export abstract class MembershipStore {
  abstract findByTenantAndUser(tenantId: string, userId: string): Promise<Membership | null>;
  abstract findAllByTenant(tenantId: string): Promise<Membership[]>;
  abstract findAllByUser(userId: string): Promise<Membership[]>;
  abstract save(input: { id: string; tenantId: string; userId: string; role: MembershipRole }): Promise<Membership>;
  abstract delete(tenantId: string, userId: string): Promise<void>;
  abstract countByRole(tenantId: string, role: MembershipRole): Promise<number>;
  abstract countAll(tenantId: string): Promise<number>;
}
