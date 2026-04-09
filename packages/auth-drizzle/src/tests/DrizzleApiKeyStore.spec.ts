import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DrizzleApiKeyStore } from '../libs/DrizzleApiKeyStore';
import type { apiKeys as apiKeysSchema } from '../schema';

describe('DrizzleApiKeyStore', () => {
  let store!: DrizzleApiKeyStore;
  let mockDb!: {
    insert: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
    query: {
      apiKeys: {
        findFirst: ReturnType<typeof vi.fn>;
        findMany: ReturnType<typeof vi.fn>;
      };
    };
  };

  beforeEach(() => {
    mockDb = {
      insert: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      query: {
        apiKeys: {
          findFirst: vi.fn(),
          findMany: vi.fn(),
        },
      },
    };

    store = new DrizzleApiKeyStore(mockDb as unknown as ConstructorParameters<typeof DrizzleApiKeyStore>[0], {
      apiKeys: {} as typeof apiKeysSchema,
    });
  });

  describe('findById', () => {
    it('should return API key when found', async () => {
      const mockKey = {
        id: 'key-1',
        prefix: 'test',
        shortToken: 'short123',
        hash: 'hash123',
        permissions: ['read', 'write'],
        name: 'Test Key',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        createdAt: new Date(),
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        rateLimit: null,
        allowedIps: null,
      };

      mockDb.query.apiKeys.findFirst.mockResolvedValue(mockKey);

      const result = await store.findById('key-1');

      expect(result).not.toBeNull();
      expect(result?.id).toBe('key-1');
      expect(result?.name).toBe('Test Key');
    });

    it('should return null when API key not found', async () => {
      mockDb.query.apiKeys.findFirst.mockResolvedValue(null);

      const result = await store.findById('non-existent');

      expect(result).toBeNull();
    });

    it('should return null when row validation fails', async () => {
      mockDb.query.apiKeys.findFirst.mockResolvedValue({ invalid: 'data' });

      const result = await store.findById('key-1');

      expect(result).toBeNull();
    });
  });

  describe('findByShortToken', () => {
    it('should return API key when token found', async () => {
      const mockKey = {
        id: 'key-1',
        prefix: 'test',
        shortToken: 'short123',
        hash: 'hash123',
        permissions: ['read'],
        name: 'Test Key',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        createdAt: new Date(),
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        rateLimit: null,
        allowedIps: null,
      };

      mockDb.query.apiKeys.findFirst.mockResolvedValue(mockKey);

      const result = await store.findByShortToken('short123');

      expect(result).not.toBeNull();
      expect(result?.shortToken).toBe('short123');
    });

    it('should return null when token not found', async () => {
      mockDb.query.apiKeys.findFirst.mockResolvedValue(null);

      const result = await store.findByShortToken('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('save', () => {
    it('should create new API key', async () => {
      const mockKey = {
        id: 'key-1',
        prefix: 'test',
        shortToken: 'short123',
        hash: 'hash123',
        permissions: ['read'],
        name: 'Test Key',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        createdAt: new Date(),
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
        rateLimit: null,
        allowedIps: null,
      };

      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([mockKey]),
        }),
      });

      const result = await store.save({
        prefix: 'test',
        shortToken: 'short123',
        hash: 'hash123',
        permissions: ['read'],
        name: 'Test Key',
        tenantId: 'tenant-1',
        createdBy: 'user-1',
        expiresAt: null,
        revokedAt: null,
        lastUsedAt: null,
      });

      expect(result.id).toBe('key-1');
      expect(result.name).toBe('Test Key');
    });

    it('should throw error when save fails', async () => {
      mockDb.insert.mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ invalid: 'data' }]),
        }),
      });

      await expect(
        store.save({
          prefix: 'test',
          shortToken: 'short123',
          hash: 'hash123',
          permissions: ['read'],
          name: 'Test Key',
          tenantId: 'tenant-1',
          createdBy: 'user-1',
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
        })
      ).rejects.toThrow('Failed to create API key');
    });
  });

  describe('updateLastUsed', () => {
    it('should update last used timestamp', async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      mockDb.update.mockReturnValue({ set: setMock });

      await store.updateLastUsed('key-1');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('revoke', () => {
    it('should revoke API key', async () => {
      const setMock = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      mockDb.update.mockReturnValue({ set: setMock });

      await store.revoke('key-1');

      expect(mockDb.update).toHaveBeenCalled();
    });
  });

  describe('listByTenant', () => {
    it('should return keys for tenant', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          prefix: 'test',
          shortToken: 'short1',
          hash: 'hash1',
          permissions: ['read'],
          name: 'Key 1',
          tenantId: 'tenant-1',
          createdBy: 'user-1',
          createdAt: new Date(),
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          rateLimit: null,
          allowedIps: null,
        },
        {
          id: 'key-2',
          prefix: 'test',
          shortToken: 'short2',
          hash: 'hash2',
          permissions: ['write'],
          name: 'Key 2',
          tenantId: 'tenant-1',
          createdBy: 'user-1',
          createdAt: new Date(),
          expiresAt: null,
          revokedAt: null,
          lastUsedAt: null,
          rateLimit: null,
          allowedIps: null,
        },
      ];

      mockDb.query.apiKeys.findMany.mockResolvedValue(mockKeys);

      const result = await store.listByTenant('tenant-1');

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('key-1');
      expect(result[1].id).toBe('key-2');
    });

    it('should return empty array when no keys exist', async () => {
      mockDb.query.apiKeys.findMany.mockResolvedValue([]);

      const result = await store.listByTenant('tenant-1');

      expect(result).toEqual([]);
    });

    it('should filter out invalid rows', async () => {
      const mockKeys = [
        {
          id: 'key-1',
          prefix: 'test',
          shortToken: 'short1',
          hash: 'hash1',
          permissions: ['read'],
          name: 'Key 1',
          tenantId: 'tenant-1',
          createdBy: 'user-1',
          createdAt: new Date(),
        },
        { invalid: 'data' },
      ];

      mockDb.query.apiKeys.findMany.mockResolvedValue(mockKeys);

      const result = await store.listByTenant('tenant-1');

      expect(result).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('should delete API key', async () => {
      const whereMock = vi.fn().mockResolvedValue(undefined);
      mockDb.delete.mockReturnValue({ where: whereMock });

      await store.delete('key-1');

      expect(mockDb.delete).toHaveBeenCalled();
    });
  });
});
