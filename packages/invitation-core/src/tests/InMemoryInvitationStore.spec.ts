import { beforeEach, describe, expect, it } from 'vitest';
import { InMemoryInvitationStore } from '../libs/InMemoryInvitationStore';
import type { Invitation } from '../libs/types';

describe('InMemoryInvitationStore compareAndSetStatus', () => {
  let store!: InMemoryInvitationStore;

  const createInvitation = (overrides: Partial<Invitation> = {}): Invitation => {
    return {
      id: overrides.id ?? 'inv-1',
      tenantId: overrides.tenantId ?? 'tenant-1',
      inviterId: overrides.inviterId ?? 'user-1',
      email: overrides.email ?? 'member@croco.dev',
      tokenHash: overrides.tokenHash ?? 'hash-1',
      type: overrides.type ?? 'email',
      role: overrides.role ?? 'member',
      status: overrides.status ?? 'pending',
      expiresAt: overrides.expiresAt ?? new Date('2026-01-10T00:00:00.000Z'),
      acceptedAt: overrides.acceptedAt ?? null,
      revokedAt: overrides.revokedAt ?? null,
      createdAt: overrides.createdAt ?? new Date('2026-01-01T00:00:00.000Z'),
    };
  };

  beforeEach(() => {
    store = new InMemoryInvitationStore();
  });

  it('should allow only one concurrent status transition from the expected status', async () => {
    const acceptedAt = new Date('2026-01-02T00:00:00.000Z');
    await store.save(createInvitation({ id: 'inv-1', status: 'pending' }));

    const results = await Promise.all([
      store.compareAndSetStatus('tenant-1', 'inv-1', 'pending', 'accepted', { acceptedAt }),
      store.compareAndSetStatus('tenant-1', 'inv-1', 'pending', 'accepted', { acceptedAt }),
    ]);

    const successful = results.filter((result): result is Invitation => result !== null);
    const failed = results.filter((result) => result === null);

    expect(successful).toHaveLength(1);
    expect(successful[0].status).toBe('accepted');
    expect(successful[0].acceptedAt).toEqual(acceptedAt);
    expect(failed).toHaveLength(1);
  });
});
