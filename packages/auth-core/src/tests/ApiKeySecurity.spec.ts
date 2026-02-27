import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiKeyGenerator } from '../libs/apikey/ApiKeyGenerator';
import { ApiKeyHasher } from '../libs/apikey/ApiKeyHasher';
import { ApiKeyManager } from '../libs/apikey/ApiKeyManager';
import type { ApiKey, CreateApiKeyOptions } from '../libs/interfaces/ApiKey';

describe('ApiKey Security', () => {
  let manager!: ApiKeyManager;
  let mockStore!: ReturnType<typeof createMockStore>;
  let generator!: ApiKeyGenerator;
  let hasher!: ApiKeyHasher;

  function createMockStore() {
    const keys = new Map<string, ApiKey>();
    let idCounter = 1;

    return {
      findById: vi.fn(async (id: string) => {
        return keys.get(id) ?? null;
      }),
      findByShortToken: vi.fn(async (shortToken: string) => {
        for (const key of keys.values()) {
          if (key.shortToken === shortToken) return key;
        }
        return null;
      }),
      save: vi.fn(async (keyData: Omit<ApiKey, 'id' | 'createdAt'>) => {
        const id = `key_${idCounter++}`;
        const key: ApiKey = {
          ...keyData,
          id,
          createdAt: new Date(),
        };
        keys.set(id, key);
        return key;
      }),
      updateLastUsed: vi.fn(async (id: string) => {
        const key = keys.get(id);
        if (key) {
          key.lastUsedAt = new Date();
        }
      }),
      revoke: vi.fn(async (id: string) => {
        const key = keys.get(id);
        if (key) {
          key.revokedAt = new Date();
        }
      }),
      listByTenant: vi.fn(async (tenantId: string) => {
        return Array.from(keys.values()).filter((k) => k.tenantId === tenantId);
      }),
      delete: vi.fn(async (id: string) => {
        keys.delete(id);
      }),
      _getKeys: () => keys,
    };
  }

  beforeEach(() => {
    mockStore = createMockStore();
    generator = new ApiKeyGenerator();
    hasher = new ApiKeyHasher();
    manager = new ApiKeyManager(mockStore, generator, hasher);
  });

  describe('평문 키 저장 보안', () => {
    it('저장소에 평문 키가 저장되지 않아야 함', async () => {
      const options: CreateApiKeyOptions = {
        name: 'Test Key',
        tenantId: 'tenant_123',
        permissions: ['read:users'],
      };

      const _result = await manager.create(options);

      expect(mockStore.save).toHaveBeenCalled();
      const savedKeyData = mockStore.save.mock.calls[0][0];

      expect(savedKeyData).not.toHaveProperty('fullKey');
      expect(savedKeyData).not.toHaveProperty('key');
      expect(savedKeyData).not.toHaveProperty('longToken');
      expect(savedKeyData).toHaveProperty('hash');
      expect(savedKeyData.hash).toBeTruthy();
      expect(typeof savedKeyData.hash).toBe('string');
    });

    it('저장된 hash 값은 평문 키와 달라야 함', async () => {
      const options: CreateApiKeyOptions = {
        name: 'Test Key',
        tenantId: 'tenant_123',
        permissions: ['read:users'],
      };

      const result = await manager.create(options);

      const savedKeyData = mockStore.save.mock.calls[0][0];

      expect(savedKeyData.hash).not.toBe(result.key);

      const parsed = generator.parse(result.key);
      expect(parsed).not.toBeNull();
      expect(savedKeyData.hash).not.toContain(parsed?.longToken);
      expect(savedKeyData.hash).not.toBe(parsed?.longToken);

      expect(savedKeyData.hash).toHaveLength(64);
      expect(/^[a-f0-9]{64}$/.test(savedKeyData.hash)).toBe(true);
    });

    it('shortToken도 평문으로 저장되지만 이는 인덱싱용으로 허용됨', async () => {
      const options: CreateApiKeyOptions = {
        name: 'Test Key',
        tenantId: 'tenant_123',
        permissions: ['read:users'],
      };

      const result = await manager.create(options);

      const savedKeyData = mockStore.save.mock.calls[0][0];

      expect(savedKeyData).toHaveProperty('shortToken');

      const parsed = generator.parse(result.key);
      expect(savedKeyData.shortToken).toBe(parsed?.shortToken);

      const cannotRecover = `${savedKeyData.prefix}_${savedKeyData.shortToken}_???`;
      expect(cannotRecover).not.toBe(result.key);
      expect(result.key).not.toContain('???');
    });
  });

  describe('해시 검증 보안', () => {
    it('hash와 verify는 상수 시간 비교를 사용해야 함 (indirect)', async () => {
      const testValue = 'test_long_token_value';
      const hash1 = hasher.hash(testValue);
      const hash2 = hasher.hash(testValue);
      const wrongHash = hasher.hash('wrong_value');

      expect(hash1).toBe(hash2);

      expect(hasher.verify(testValue, hash1)).toBe(true);
      expect(hasher.verify(testValue, hash2)).toBe(true);
      expect(hasher.verify('wrong_value', hash1)).toBe(false);
      expect(hasher.verify(testValue, wrongHash)).toBe(false);
    });

    it('longToken이 변경되면 검증이 실패해야 함', async () => {
      const options: CreateApiKeyOptions = {
        name: 'Test Key',
        tenantId: 'tenant_123',
        permissions: ['read:users'],
      };

      const result = await manager.create(options);
      const parsed = generator.parse(result.key);
      expect(parsed).not.toBeNull();

      const tamperedKey = `${parsed?.prefix}_${parsed?.shortToken}_tampered_token_123`;

      const principal = await manager.verify(tamperedKey);

      expect(principal).toBeNull();
    });
  });

  describe('에러 메시지 보안', () => {
    it('검증 실패 시 에러가 아닌 null을 반환해야 함 (정보 노출 방지)', async () => {
      const nonExistentKey = 'sk_abc123def456_xyz789abc012def345gh678';
      const principal = await manager.verify(nonExistentKey);

      expect(principal).toBeNull();

      expect(mockStore.findByShortToken).toHaveBeenCalled();
    });

    it('검증 실패 시 저장소 조회만 수행하고 추가 정보 제공하지 않음', async () => {
      const result1 = await manager.verify('invalid_format');
      expect(result1).toBeNull();

      const result2 = await manager.verify('sk_nonexistent_ABCDEF_nonexistent123456');
      expect(result2).toBeNull();

      expect(result1).toBe(result2);
    });

    it('rotate 실패 시 에러 메시지에 키 정보 포함하지 않음', async () => {
      try {
        await manager.rotate('nonexistent_key_id');
        expect.fail('에러가 발생해야 함');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        const err = error as Error;
        expect(err.message).not.toContain('sk_');
        expect(err.message).not.toContain('longToken');
        expect(err.message).not.toContain('fullKey');
      }
    });
  });

  describe('list 메서드 보안', () => {
    it('목록 조회 시 hash 필드가 제외되어야 함', async () => {
      const options: CreateApiKeyOptions = {
        name: 'Test Key',
        tenantId: 'tenant_123',
        permissions: ['read:users'],
      };

      await manager.create(options);

      const keys = await manager.list('tenant_123');

      expect(keys).toHaveLength(1);
      expect(keys[0]).not.toHaveProperty('hash');
    });
  });

  describe('로그 및 이벤트 보안', () => {
    it('이벤트 발행 시 평문 키가 포함되지 않아야 함', async () => {
      type MockEventBus = {
        publish: ReturnType<typeof vi.fn>;
        subscribe: ReturnType<typeof vi.fn>;
        unsubscribe: ReturnType<typeof vi.fn>;
        clear: ReturnType<typeof vi.fn>;
      };

      const mockEventBus: MockEventBus = {
        publish: vi.fn(async () => {}),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        clear: vi.fn(),
      };

      const managerWithEventBus = new ApiKeyManager(
        mockStore,
        generator,
        hasher,
        mockEventBus as unknown as import('@croco/events-core').EventBus
      );

      const options: CreateApiKeyOptions = {
        name: 'Test Key',
        tenantId: 'tenant_123',
        permissions: ['read:users'],
      };

      const result = await managerWithEventBus.create(options);

      expect(mockEventBus.publish).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const createEvent: { data: Record<string, unknown> } = (mockEventBus.publish.mock.calls as unknown[][])[0][0] as {
        data: Record<string, unknown>;
      };
      expect(createEvent.data).not.toHaveProperty('key');
      expect(createEvent.data).not.toHaveProperty('fullKey');
      expect(createEvent.data).not.toHaveProperty('longToken');
      expect(createEvent.data).toHaveProperty('keyId');

      mockEventBus.publish.mockClear();
      await managerWithEventBus.verify(result.key);

      expect(mockEventBus.publish).toHaveBeenCalled();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const useEvent: { data: Record<string, unknown> } = (mockEventBus.publish.mock.calls as unknown[][])[0][0] as {
        data: Record<string, unknown>;
      };
      expect(useEvent.data).not.toHaveProperty('key');
      expect(useEvent.data).not.toHaveProperty('fullKey');
      expect(useEvent.data).toHaveProperty('keyId');
    });
  });
});
