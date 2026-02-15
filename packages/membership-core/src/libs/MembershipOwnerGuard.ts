import type { MembershipStore } from './MembershipStore';
import { LastOwnerCannotBeRemovedProblem } from './problems/LastOwnerCannotBeRemovedProblem';
import { MembershipConstraintProblem } from './problems/MembershipConstraintProblem';
import type { Membership, MembershipRole } from './types';

export class MembershipOwnerGuard {
  constructor(private readonly store: MembershipStore) {}

  async validateOwnerMutation(input: {
    tenantId: string;
    userId: string;
    currentRole: MembershipRole;
    operation: 'remove' | 'demote';
    nextRole?: MembershipRole;
  }): Promise<void> {
    const isOwnerMutation =
      input.currentRole === 'owner' && (input.operation === 'remove' || input.nextRole !== 'owner');

    if (!isOwnerMutation) {
      return;
    }

    const isLastOwner = await this.isLastOwner(input.tenantId, input.userId, input.currentRole);
    if (!isLastOwner) {
      return;
    }

    if (input.operation === 'remove') {
      throw new LastOwnerCannotBeRemovedProblem(input.tenantId, input.userId);
    }

    throw new MembershipConstraintProblem(
      `Cannot ${input.operation} the last owner '${input.userId}' in tenant '${input.tenantId}'`,
      {
        tenantId: input.tenantId,
        userId: input.userId,
        operation: input.operation,
      }
    );
  }

  private async isLastOwner(tenantId: string, userId: string, currentRole: MembershipRole): Promise<boolean> {
    if (currentRole !== 'owner') {
      return false;
    }

    const owners = await this.findOwners(tenantId);
    const isTargetOwner = owners.some((owner) => owner.userId === userId);
    return owners.length === 1 && isTargetOwner;
  }

  private async findOwners(tenantId: string): Promise<Membership[]> {
    const memberships = await this.store.findAllByTenant(tenantId);
    return memberships.filter((membership) => membership.role === 'owner');
  }
}
