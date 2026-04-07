import 'reflect-metadata';
import type { Membership, MembershipCreateInput } from '@croco/membership-core';
import type { TxManager } from '@croco/tx-core';
import type { DrizzleDb } from '@croco/tx-drizzle';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type DrizzleMembershipClient, DrizzleMembershipStore } from '../libs/DrizzleMembershipStore';

const createInput = (overrides: Partial<MembershipCreateInput> = {}): MembershipCreateInput => {
  return {
    id: overrides.id ?? 'mem-1',
    tenantId: overrides.tenantId ?? 'tenant-1',
    userId: overrides.userId ?? 'user-1',
    role: overrides.role ?? 'member',
  };
};

const createMembership = (input: MembershipCreateInput): Membership => {
  const now = new Date('2026-01-01T00:00:00.000Z');
  return {
    id: input.id,
    tenantId: input.tenantId,
    userId: input.userId,
    role: input.role,
    createdAt: now,
    updatedAt: now,
  };
};

describe('DrizzleMembershipStore', () => {
  let store!: DrizzleMembershipStore;

  let mockDb!: {
    select: ReturnType<typeof vi.fn>;
    insert: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    transaction?: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockDb = {
      select: vi.fn(),
      insert: vi.fn(),
      delete: vi.fn(),
      transaction: vi.fn(),
    };

    const mockTxManager = {
      getClient: vi.fn().mockReturnValue(null),
    };

    store = new DrizzleMembershipStore(
      mockDb as unknown as DrizzleMembershipClient,
      mockTxManager as unknown as TxManager<DrizzleMembershipClient>
    );
  });

  it('should save and find membership by tenant and user', async () => {
    const input = createInput();
    const saved = createMembership(input);

    mockDb.insert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([saved]),
        }),
      }),
    });

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([saved]),
        }),
      }),
    });

    await store.save(input);
    const membership = await store.findByTenantAndUser('tenant-1', 'user-1');

    expect(membership).not.toBeNull();
    expect(membership?.id).toBe('mem-1');
    expect(membership?.role).toBe('member');
  });

  it('should return all memberships by tenant', async () => {
    const rows = [
      createMembership(createInput({ id: 'mem-1', tenantId: 'tenant-1', userId: 'user-1' })),
      createMembership(createInput({ id: 'mem-2', tenantId: 'tenant-1', userId: 'user-2' })),
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });

    const memberships = await store.findAllByTenant('tenant-1');

    expect(memberships).toHaveLength(2);
    expect(memberships.map((membership) => membership.id).sort()).toEqual(['mem-1', 'mem-2']);
  });

  it('should return all memberships by user', async () => {
    const rows = [
      createMembership(createInput({ id: 'mem-1', tenantId: 'tenant-1', userId: 'user-1' })),
      createMembership(createInput({ id: 'mem-2', tenantId: 'tenant-2', userId: 'user-1' })),
    ];

    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(rows),
      }),
    });

    const memberships = await store.findAllByUser('user-1');

    expect(memberships).toHaveLength(2);
    expect(memberships.map((membership) => membership.id).sort()).toEqual(['mem-1', 'mem-2']);
  });

  it('should delete membership', async () => {
    mockDb.delete.mockReturnValue({
      where: vi.fn().mockResolvedValue(undefined),
    });

    await expect(store.delete('tenant-1', 'user-1')).resolves.toBeUndefined();
    expect(mockDb.delete).toHaveBeenCalled();
  });

  it('should count memberships by role in tenant', async () => {
    mockDb.select.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([{ total: 2 }]),
      }),
    });

    const count = await store.countByRole('tenant-1', 'admin');

    expect(count).toBe(2);
  });

  it('should update membership when saving same tenant and user', async () => {
    const initial = createMembership(createInput({ id: 'mem-1', role: 'member' }));
    const updated = createMembership(createInput({ id: 'mem-1', role: 'admin' }));

    mockDb.insert
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([initial]),
          }),
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([updated]),
          }),
        }),
      });

    const first = await store.save(createInput({ id: 'mem-1', role: 'member' }));
    const next = await store.save(createInput({ id: 'mem-1', role: 'admin' }));

    expect(first.role).toBe('member');
    expect(next.role).toBe('admin');
  });
});
