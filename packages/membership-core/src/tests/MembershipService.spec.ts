import 'reflect-metadata';
import type { EventPublisher } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMembershipStore } from '../libs/InMemoryMembershipStore';
import { MembershipService } from '../libs/MembershipService';
import { LastOwnerCannotBeRemovedProblem } from '../libs/problems/LastOwnerCannotBeRemovedProblem';
import { MembershipConstraintProblem } from '../libs/problems/MembershipConstraintProblem';
import { InvalidRoleProblem } from '../libs/problems/MembershipProblems';

describe('MembershipService', () => {
  let service!: MembershipService;
  let store!: InMemoryMembershipStore;
  let publish!: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    Container.reset();

    store = new InMemoryMembershipStore();
    publish = vi.fn();

    service = new MembershipService(store, {
      publish,
      publishMany: vi.fn(),
    } as unknown as EventPublisher);
  });

  it('should propagate event publication failures when adding a member', async () => {
    publish.mockRejectedValueOnce(new Error('publish failed'));

    await expect(service.addMember('tenant-1', 'user-1', 'member')).rejects.toThrow('publish failed');
  });

  it('should throw InvalidRoleProblem when adding a member with invalid role', async () => {
    await expect(service.addMember('tenant-1', 'user-1', 'invalid' as never)).rejects.toBeInstanceOf(
      InvalidRoleProblem
    );
  });

  it('BUG-10 마지막 오너는 삭제할 수 없다', async () => {
    await store.save({
      id: 'mem-owner',
      tenantId: 'tenant-1',
      userId: 'user-owner',
      role: 'owner',
    });

    await expect(service.removeMember('tenant-1', 'user-owner')).rejects.toBeInstanceOf(
      LastOwnerCannotBeRemovedProblem
    );
  });

  it('BUG-10 마지막 오너 권한 변경은 제한된다', async () => {
    await store.save({
      id: 'mem-owner',
      tenantId: 'tenant-1',
      userId: 'user-owner',
      role: 'owner',
    });

    await expect(service.updateRole('tenant-1', 'user-owner', 'member')).rejects.toBeInstanceOf(
      MembershipConstraintProblem
    );
  });

  it('should throw InvalidRoleProblem when updating to invalid role', async () => {
    await store.save({
      id: 'mem-member',
      tenantId: 'tenant-1',
      userId: 'user-member',
      role: 'member',
    });

    await expect(service.updateRole('tenant-1', 'user-member', 'invalid' as never)).rejects.toBeInstanceOf(
      InvalidRoleProblem
    );
  });
});
