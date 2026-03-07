import 'reflect-metadata';
import type { EventPublisher } from '@croco/events-core';
import { Container } from '@croco/framework-context';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MembershipCreatedEvent } from '../libs/events/MembershipCreatedEvent';
import { MembershipRemovedEvent } from '../libs/events/MembershipRemovedEvent';
import { MembershipUpdatedEvent } from '../libs/events/MembershipUpdatedEvent';
import { InMemoryMembershipStore } from '../libs/InMemoryMembershipStore';
import { MembershipManager } from '../libs/MembershipManager';
import {
  AlreadyMemberProblem,
  InvalidRoleProblem,
  LastOwnerProblem,
  MembershipNotFoundProblem,
} from '../libs/problems/MembershipProblems';
import type { MembershipCreateInput, MembershipRole } from '../libs/types';

describe('MembershipManager', () => {
  let manager!: MembershipManager;
  let store!: InMemoryMembershipStore;
  let publish!: ReturnType<typeof vi.fn>;

  const createInput = (overrides: Partial<MembershipCreateInput> = {}): MembershipCreateInput => {
    return {
      id: overrides.id ?? 'mem-1',
      tenantId: overrides.tenantId ?? 'tenant-1',
      userId: overrides.userId ?? 'user-1',
      role: overrides.role ?? 'member',
    };
  };

  const seedMembership = async (overrides: Partial<MembershipCreateInput> = {}): Promise<void> => {
    await store.save(createInput(overrides));
  };

  beforeEach(() => {
    Container.reset();

    store = new InMemoryMembershipStore();
    publish = vi.fn();

    manager = new MembershipManager(store, {
      publish,
      publishMany: vi.fn(),
    } as unknown as EventPublisher);
  });

  it('should propagate event publication failures when adding a member', async () => {
    publish.mockRejectedValueOnce(new Error('publish failed'));

    await expect(manager.addMember('tenant-1', 'user-1', 'member')).rejects.toThrow('publish failed');
  });

  it('should add member and publish MembershipCreatedEvent', async () => {
    const membership = await manager.addMember('tenant-1', 'user-1', 'member');

    expect(membership.tenantId).toBe('tenant-1');
    expect(membership.userId).toBe('user-1');
    expect(membership.role).toBe('member');
    expect(publish).toHaveBeenCalledWith(expect.any(MembershipCreatedEvent));

    const [event] = publish.mock.calls[0] as [MembershipCreatedEvent];
    expect(event.data).toEqual({ tenantId: 'tenant-1', userId: 'user-1', role: 'member' });
  });

  it('should throw AlreadyMemberProblem when adding duplicate member', async () => {
    await seedMembership();

    await expect(manager.addMember('tenant-1', 'user-1', 'member')).rejects.toBeInstanceOf(AlreadyMemberProblem);
  });

  it('should throw InvalidRoleProblem when role is invalid', async () => {
    await expect(manager.addMember('tenant-1', 'user-1', 'invalid' as MembershipRole)).rejects.toBeInstanceOf(
      InvalidRoleProblem
    );
  });

  it('should return member with getMember', async () => {
    await seedMembership();

    const membership = await manager.getMember('tenant-1', 'user-1');

    expect(membership.id).toBe('mem-1');
    expect(membership.role).toBe('member');
  });

  it('should throw MembershipNotFoundProblem when getMember target is missing', async () => {
    await expect(manager.getMember('tenant-1', 'missing-user')).rejects.toBeInstanceOf(MembershipNotFoundProblem);
  });

  it('should list members by tenant', async () => {
    await seedMembership({ id: 'mem-1', tenantId: 'tenant-1', userId: 'user-1' });
    await seedMembership({ id: 'mem-2', tenantId: 'tenant-1', userId: 'user-2' });
    await seedMembership({ id: 'mem-3', tenantId: 'tenant-2', userId: 'user-3' });

    const memberships = await manager.listMembers('tenant-1');

    expect(memberships).toHaveLength(2);
    expect(memberships.map((membership) => membership.id).sort()).toEqual(['mem-1', 'mem-2']);
  });

  it('should list tenants by user', async () => {
    await seedMembership({ id: 'mem-1', tenantId: 'tenant-1', userId: 'user-1' });
    await seedMembership({ id: 'mem-2', tenantId: 'tenant-2', userId: 'user-1' });
    await seedMembership({ id: 'mem-3', tenantId: 'tenant-2', userId: 'user-2' });

    const memberships = await manager.listTenants('user-1');

    expect(memberships).toHaveLength(2);
    expect(memberships.map((membership) => membership.id).sort()).toEqual(['mem-1', 'mem-2']);
  });

  it('should remove member and publish MembershipRemovedEvent', async () => {
    await seedMembership({ role: 'member' });

    await manager.removeMember('tenant-1', 'user-1');

    const membership = await store.findByTenantAndUser('tenant-1', 'user-1');
    expect(membership).toBeNull();
    expect(publish).toHaveBeenCalledWith(expect.any(MembershipRemovedEvent));

    const [event] = publish.mock.calls[0] as [MembershipRemovedEvent];
    expect(event.data).toEqual({ tenantId: 'tenant-1', userId: 'user-1', role: 'member' });
  });

  it('should prevent removing the last owner', async () => {
    await seedMembership({ role: 'owner' });

    await expect(manager.removeMember('tenant-1', 'user-1')).rejects.toBeInstanceOf(LastOwnerProblem);
  });

  it('should update role and publish MembershipUpdatedEvent', async () => {
    await seedMembership({ role: 'member' });

    const membership = await manager.updateRole('tenant-1', 'user-1', 'admin');

    expect(membership.role).toBe('admin');
    expect(publish).toHaveBeenCalledWith(expect.any(MembershipUpdatedEvent));

    const [event] = publish.mock.calls[0] as [MembershipUpdatedEvent];
    expect(event.data).toEqual({
      tenantId: 'tenant-1',
      userId: 'user-1',
      oldRole: 'member',
      newRole: 'admin',
    });
  });

  it('should prevent demoting the last owner', async () => {
    await seedMembership({ role: 'owner' });

    await expect(manager.updateRole('tenant-1', 'user-1', 'member')).rejects.toBeInstanceOf(LastOwnerProblem);
  });

  it('should throw MembershipNotFoundProblem when update target is missing', async () => {
    await expect(manager.updateRole('tenant-1', 'missing-user', 'member')).rejects.toBeInstanceOf(
      MembershipNotFoundProblem
    );
  });

  it('should throw InvalidRoleProblem when updating to invalid role', async () => {
    await seedMembership({ role: 'member' });

    await expect(manager.updateRole('tenant-1', 'user-1', 'invalid' as MembershipRole)).rejects.toBeInstanceOf(
      InvalidRoleProblem
    );
  });
});
