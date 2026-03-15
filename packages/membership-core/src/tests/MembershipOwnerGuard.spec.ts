import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryMembershipStore } from '../libs/InMemoryMembershipStore';
import { MembershipOwnerGuard } from '../libs/MembershipOwnerGuard';
import { LastOwnerCannotBeRemovedProblem } from '../libs/problems/LastOwnerCannotBeRemovedProblem';
import { MembershipConstraintProblem } from '../libs/problems/MembershipConstraintProblem';
import type { MembershipCreateInput } from '../libs/types';

describe('MembershipOwnerGuard', () => {
  let guard!: MembershipOwnerGuard;
  let store!: InMemoryMembershipStore;

  const createInput = (overrides: Partial<MembershipCreateInput> = {}): MembershipCreateInput => {
    return {
      id: overrides.id ?? 'mem-1',
      tenantId: overrides.tenantId ?? 'tenant-1',
      userId: overrides.userId ?? 'user-1',
      role: overrides.role ?? 'member',
    };
  };

  beforeEach(() => {
    store = new InMemoryMembershipStore();
    guard = new MembershipOwnerGuard(store);
  });

  it('should throw LastOwnerCannotBeRemovedProblem when removing the last owner', async () => {
    await store.save(createInput({ id: 'mem-owner', userId: 'user-owner', role: 'owner' }));

    await expect(
      guard.validateOwnerMutation({
        tenantId: 'tenant-1',
        userId: 'user-owner',
        currentRole: 'owner',
        operation: 'remove',
      })
    ).rejects.toBeInstanceOf(LastOwnerCannotBeRemovedProblem);
  });

  it('should throw MembershipConstraintProblem when demoting the last owner', async () => {
    await store.save(createInput({ id: 'mem-owner', userId: 'user-owner', role: 'owner' }));

    await expect(
      guard.validateOwnerMutation({
        tenantId: 'tenant-1',
        userId: 'user-owner',
        currentRole: 'owner',
        operation: 'demote',
        nextRole: 'member',
      })
    ).rejects.toBeInstanceOf(MembershipConstraintProblem);
  });

  it('should allow removing an owner when another owner exists', async () => {
    await store.save(createInput({ id: 'mem-owner-1', userId: 'user-owner-1', role: 'owner' }));
    await store.save(createInput({ id: 'mem-owner-2', userId: 'user-owner-2', role: 'owner' }));

    await expect(
      guard.validateOwnerMutation({
        tenantId: 'tenant-1',
        userId: 'user-owner-1',
        currentRole: 'owner',
        operation: 'remove',
      })
    ).resolves.toBeUndefined();
  });
});
