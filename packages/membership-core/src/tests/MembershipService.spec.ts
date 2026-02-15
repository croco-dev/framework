import 'reflect-metadata';
import type { EventPublisher } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InMemoryMembershipStore } from '../libs/InMemoryMembershipStore';
import { MembershipService } from '../libs/MembershipService';
import { LastOwnerCannotBeRemovedProblem } from '../libs/problems/LastOwnerCannotBeRemovedProblem';
import { MembershipConstraintProblem } from '../libs/problems/MembershipConstraintProblem';

describe('MembershipService', () => {
  let service!: MembershipService;
  let store!: InMemoryMembershipStore;

  beforeEach(() => {
    Container.reset();

    store = new InMemoryMembershipStore();

    service = new MembershipService(store, {
      publish: vi.fn(),
      publishMany: vi.fn(),
    } as unknown as EventPublisher);
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
});
