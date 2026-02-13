import 'reflect-metadata';
import type { EventPublisher } from '@croco/events-core';
import type { Membership } from '@croco/membership-core';
import { AlreadyMemberProblem, type MembershipManager } from '@croco/membership-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DomainPolicyManager } from '../libs/DomainPolicyManager';
import {
  DomainAutoJoinedEvent,
  DomainPolicyAddedEvent,
  DomainPolicyRemovedEvent,
} from '../libs/events/DomainPolicyEvents';
import { InMemoryDomainPolicyStore } from '../libs/InMemoryDomainPolicyStore';
import { InvalidAutoJoinRoleProblem, PublicEmailDomainNotAllowedProblem } from '../libs/problems/DomainPolicyProblems';

describe('DomainPolicyManager', () => {
  let manager!: DomainPolicyManager;
  let store!: InMemoryDomainPolicyStore;
  let publish!: ReturnType<typeof vi.fn>;
  let addMember!: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    store = new InMemoryDomainPolicyStore();
    publish = vi.fn();
    addMember = vi.fn();

    manager = new DomainPolicyManager(
      store,
      { addMember } as unknown as MembershipManager,
      {
        publish,
        publishMany: vi.fn(),
      } as unknown as EventPublisher
    );
  });

  it('should add domain policy with normalized domain', async () => {
    const policy = await manager.addDomainPolicy('tenant-1', '  Croco.Dev  ', 'member');

    expect(policy.tenantId).toBe('tenant-1');
    expect(policy.domain).toBe('croco.dev');
    expect(policy.role).toBe('member');
    expect(policy.enabled).toBe(true);
    expect(publish).toHaveBeenCalledWith(expect.any(DomainPolicyAddedEvent));

    const [event] = publish.mock.calls[0] as [DomainPolicyAddedEvent];
    expect(event.data).toEqual({ tenantId: 'tenant-1', domain: 'croco.dev', role: 'member' });
  });

  it('should reject public email domains', async () => {
    await expect(manager.addDomainPolicy('tenant-1', 'gmail.com', 'member')).rejects.toBeInstanceOf(
      PublicEmailDomainNotAllowedProblem
    );
  });

  it('should reject admin and owner role for auto-join', async () => {
    await expect(manager.addDomainPolicy('tenant-1', 'croco.dev', 'admin')).rejects.toBeInstanceOf(
      InvalidAutoJoinRoleProblem
    );

    await expect(manager.addDomainPolicy('tenant-1', 'croco.dev', 'owner')).rejects.toBeInstanceOf(
      InvalidAutoJoinRoleProblem
    );
  });

  it('should list policies by tenant', async () => {
    await manager.addDomainPolicy('tenant-1', 'croco.dev', 'member');
    await manager.addDomainPolicy('tenant-1', 'example.com', 'viewer');
    await manager.addDomainPolicy('tenant-2', 'other.dev', 'member');

    const policies = await manager.listDomainPolicies('tenant-1');

    expect(policies).toHaveLength(2);
    expect(policies.map((policy) => policy.domain).sort()).toEqual(['croco.dev', 'example.com']);
  });

  it('should remove domain policy with normalized domain', async () => {
    await manager.addDomainPolicy('tenant-1', 'croco.dev', 'member');

    await manager.removeDomainPolicy('tenant-1', ' Croco.Dev ');

    const policy = await store.findByTenantAndDomain('tenant-1', 'croco.dev');
    expect(policy).toBeNull();
    expect(publish).toHaveBeenCalledWith(expect.any(DomainPolicyRemovedEvent));
  });

  it('should auto-join member when email domain matches policy', async () => {
    await manager.addDomainPolicy('tenant-1', 'croco.dev', 'member');

    const membership: Membership = {
      id: 'mem-1',
      tenantId: 'tenant-1',
      userId: 'user-1',
      role: 'member',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    };
    addMember.mockResolvedValue(membership);

    const result = await manager.tryAutoJoin('tenant-1', 'user-1', 'User@Croco.Dev');

    expect(addMember).toHaveBeenCalledWith('tenant-1', 'user-1', 'member');
    expect(result).toEqual(membership);
    expect(publish).toHaveBeenCalledWith(expect.any(DomainAutoJoinedEvent));
  });

  it('should return null when no matching policy exists', async () => {
    const result = await manager.tryAutoJoin('tenant-1', 'user-1', 'user@unknown.dev');

    expect(result).toBeNull();
    expect(addMember).not.toHaveBeenCalled();
  });

  it('should return null when user is already a member', async () => {
    await manager.addDomainPolicy('tenant-1', 'croco.dev', 'viewer');
    addMember.mockRejectedValue(new AlreadyMemberProblem('tenant-1', 'user-1'));

    const result = await manager.tryAutoJoin('tenant-1', 'user-1', 'user@croco.dev');

    expect(result).toBeNull();
  });
});
