import 'reflect-metadata';
import type { Invitation } from '@croco/invitation-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleInvitationStore } from '../libs/DrizzleInvitationStore';

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

const createUpdateChain = (rows: Invitation[]) => {
  return {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
};

describe('DrizzleInvitationStore', () => {
  let store!: DrizzleInvitationStore;
  let mockDb!: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      update: vi.fn(),
    };

    const mockTxManager = {
      getClient: vi.fn().mockReturnValue(null),
    };

    store = new DrizzleInvitationStore(
      mockDb as unknown as DrizzleDb & {
        select: (...args: unknown[]) => unknown;
        insert: (...args: unknown[]) => unknown;
        update: (...args: unknown[]) => unknown;
      },
      mockTxManager as unknown as TxManager<
        DrizzleDb & {
          select: (...args: unknown[]) => unknown;
          insert: (...args: unknown[]) => unknown;
          update: (...args: unknown[]) => unknown;
        }
      >
    );
  });

  it('should save and find invitation by id', async () => {
    const invitation = createInvitation();

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([invitation]),
        }),
      }),
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([invitation]),
        }),
      }),
    });

    await store.save(invitation);
    const found = await store.findById('inv-1');

    expect(found).not.toBeNull();
    expect(found?.id).toBe('inv-1');
  });

  it('should find invitation by token hash', async () => {
    const invitation = createInvitation({ tokenHash: 'token-hash-1' });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([invitation]),
        }),
      }),
    });

    const found = await store.findByTokenHash('token-hash-1');

    expect(found?.tokenHash).toBe('token-hash-1');
  });

  it('should find invitation by tenant and email', async () => {
    const invitation = createInvitation({ tenantId: 'tenant-1', email: 'member@croco.dev' });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([invitation]),
        }),
      }),
    });

    const found = await store.findByTenantAndEmail('tenant-1', 'member@croco.dev');

    expect(found?.id).toBe('inv-1');
  });

  it('should return all invitations by tenant', async () => {
    const rows = [
      createInvitation({ id: 'inv-1', tenantId: 'tenant-1' }),
      createInvitation({ id: 'inv-2', tenantId: 'tenant-1', tokenHash: 'hash-2' }),
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });

    const found = await store.findAllByTenant('tenant-1');

    expect(found).toHaveLength(2);
    expect(found.map((invitation) => invitation.id).sort()).toEqual(['inv-1', 'inv-2']);
  });

  it('should update status when invitation exists', async () => {
    const accepted = createInvitation({ status: 'accepted' });
    mockDb.update.mockReturnValue(createUpdateChain([accepted]));

    const updated = await store.updateStatus('inv-1', 'accepted');

    expect(updated?.status).toBe('accepted');
  });

  it('should return null when updating missing invitation', async () => {
    mockDb.update.mockReturnValue(createUpdateChain([]));

    const updated = await store.updateStatus('missing', 'revoked');

    expect(updated).toBeNull();
  });

  it('should accept invitation atomically and single-use', async () => {
    const accepted = createInvitation({ id: 'inv-1', status: 'accepted' });

    mockDb.update.mockReturnValueOnce(createUpdateChain([accepted])).mockReturnValueOnce(createUpdateChain([]));

    const first = await store.updateStatus('inv-1', 'accepted');
    const second = await store.updateStatus('inv-1', 'accepted');

    expect(first?.status).toBe('accepted');
    expect(second).toBeNull();
  });
});
