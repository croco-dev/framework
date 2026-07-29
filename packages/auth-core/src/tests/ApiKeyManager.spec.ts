import type { EventBus } from "@croco/events-core";
import * as telemetry from "@croco/telemetry-api";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiKeyGenerator } from "../libs/apikey/ApiKeyGenerator";
import { ApiKeyHasher } from "../libs/apikey/ApiKeyHasher";
import { ApiKeyManager } from "../libs/apikey/ApiKeyManager";
import { AesGcmApiKeyRotationProtector } from "../libs/apikey/ApiKeyRotationProtector";
import {
  ApiKeyCreatedEvent,
  ApiKeyRevokedEvent,
  ApiKeyRotatedEvent,
  ApiKeyUsedEvent,
} from "../libs/events/ApiKeyEvents";
import type {
  ApiKey,
  ApiKeyRotation,
  ApiKeyRotationInput,
  CreateApiKeyOptions,
} from "../libs/interfaces/ApiKey";
import { ApiKeyRotationConflictProblem, ForbiddenProblem } from "../libs/problems/AuthProblems";

type MockEventBus = {
  publish: ReturnType<typeof vi.fn>;
  subscribe: ReturnType<typeof vi.fn>;
  unsubscribe: ReturnType<typeof vi.fn>;
  clear: ReturnType<typeof vi.fn>;
};

describe("ApiKeyManager", () => {
  let manager!: ApiKeyManager;
  let mockStore!: ReturnType<typeof createMockStore>;
  let mockEventBus!: MockEventBus;
  let generator!: ApiKeyGenerator;
  let hasher!: ApiKeyHasher;
  let rotationProtector!: AesGcmApiKeyRotationProtector;

  function createMockStore() {
    const keys = new Map<string, ApiKey>();
    const rotations = new Map<string, ApiKeyRotation>();
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
      save: vi.fn(async (keyData: Omit<ApiKey, "id" | "createdAt">) => {
        const id = `key_${idCounter++}`;
        const key: ApiKey = {
          ...keyData,
          id,
          createdAt: new Date(),
        };
        keys.set(id, key);
        return key;
      }),
      rotate: vi.fn(async (input: ApiKeyRotationInput) => {
        const existingRotation = rotations.get(input.oldKeyId);
        if (existingRotation) {
          if (
            existingRotation.tenantId !== input.tenantId ||
            existingRotation.idempotencyKey !== input.idempotencyKey
          ) {
            throw new ApiKeyRotationConflictProblem();
          }
          return existingRotation;
        }

        const oldKey = keys.get(input.oldKeyId);
        if (!oldKey || oldKey.revokedAt) {
          throw new ApiKeyRotationConflictProblem();
        }
        const replacement: ApiKey = {
          ...oldKey,
          ...input.replacement,
          createdAt: new Date(),
          revokedAt: null,
          lastUsedAt: null,
        };
        oldKey.revokedAt = new Date();
        keys.set(replacement.id, replacement);
        const rotation: ApiKeyRotation = {
          ...input,
          replacement,
          createdAt: new Date(),
        };
        rotations.set(input.oldKeyId, rotation);
        return rotation;
      }),
      claimRotationEvent: vi.fn(
        async (oldKeyId: string, idempotencyKey: string, claimId: string, claimExpiresAt: Date) => {
          const rotation = rotations.get(oldKeyId);
          if (
            !rotation ||
            rotation.idempotencyKey !== idempotencyKey ||
            rotation.eventStatus === "completed" ||
            (rotation.eventStatus === "processing" &&
              rotation.eventClaimExpiresAt &&
              rotation.eventClaimExpiresAt > new Date())
          ) {
            return null;
          }
          rotation.eventStatus = "processing";
          rotation.eventClaimId = claimId;
          rotation.eventClaimExpiresAt = claimExpiresAt;
          return rotation;
        },
      ),
      completeRotationEvent: vi.fn(
        async (oldKeyId: string, idempotencyKey: string, claimId: string) => {
          const rotation = rotations.get(oldKeyId);
          if (
            !rotation ||
            rotation.idempotencyKey !== idempotencyKey ||
            rotation.eventClaimId !== claimId
          ) {
            return null;
          }
          rotation.eventStatus = "completed";
          rotation.eventClaimId = null;
          rotation.eventClaimExpiresAt = null;
          return rotation;
        },
      ),
      releaseRotationEvent: vi.fn(
        async (oldKeyId: string, idempotencyKey: string, claimId: string) => {
          const rotation = rotations.get(oldKeyId);
          if (
            rotation &&
            rotation.idempotencyKey === idempotencyKey &&
            rotation.eventClaimId === claimId
          ) {
            rotation.eventStatus = "pending";
            rotation.eventClaimId = null;
            rotation.eventClaimExpiresAt = null;
          }
        },
      ),
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

  function createMockEventBus(): MockEventBus {
    return {
      publish: vi.fn(async () => {}),
      subscribe: vi.fn(),
      unsubscribe: vi.fn(),
      clear: vi.fn(),
    };
  }

  beforeEach(() => {
    mockStore = createMockStore();
    mockEventBus = createMockEventBus();
    generator = new ApiKeyGenerator();
    hasher = new ApiKeyHasher();
    rotationProtector = new AesGcmApiKeyRotationProtector({
      activeKeyId: "test",
      keys: { test: new Uint8Array(32).fill(7) },
    });
    manager = new ApiKeyManager(
      mockStore,
      generator,
      hasher,
      mockEventBus as unknown as EventBus,
      undefined,
      rotationProtector,
    );
  });

  describe("create", () => {
    it("should create a new API key and return full key only once", async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users", "write:users"],
        prefix: "sk",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        rateLimit: { limit: 100, duration: 60 },
        allowedIps: ["192.168.1.1"],
      };

      const result = await manager.create(options);

      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("id");
      expect(result).toHaveProperty("keyStart");
      expect(result.degraded).toBeUndefined();
      expect(result.key).toMatch(/^sk_[a-zA-Z0-9_~-]+_[a-zA-Z0-9_~-]+$/);
      expect(result.keyStart).toMatch(/^sk_[a-zA-Z0-9_~-]{8}\.\.\.$/);
      expect(mockStore.save).toHaveBeenCalled();

      const savedKey = mockStore.save.mock.calls[0][0];
      expect(savedKey).not.toHaveProperty("fullKey");
      expect(savedKey).toHaveProperty("hash");
    });

    it("should publish ApiKeyCreatedEvent on success", async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };

      const result = await manager.create(options);

      expect(mockEventBus.publish).toHaveBeenCalled();
      const publishedEvent = mockEventBus.publish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(ApiKeyCreatedEvent);
      expect(publishedEvent.data.keyId).toBe(result.id);
      expect(publishedEvent.data.tenantId).toBe("tenant_123");
      expect(publishedEvent.data.name).toBe("Test Key");
    });

    it("should use default prefix when not provided", async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };

      const result = await manager.create(options);

      expect(result.key).toMatch(/^sk_/);
    });

    it("should handle null expiresAt when not provided", async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };

      await manager.create(options);

      const savedKey = mockStore.save.mock.calls[0][0];
      expect(savedKey.expiresAt).toBeNull();
    });

    it("should work without EventBus", async () => {
      const managerWithoutBus = new ApiKeyManager(mockStore, generator, hasher);
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };

      const result = await managerWithoutBus.create(options);

      expect(result).toHaveProperty("key");
      expect(result).toHaveProperty("id");
      expect(result.degraded).toBeUndefined();
    });

    it("should mark create as degraded when event publish fails", async () => {
      const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});
      mockEventBus.publish.mockRejectedValueOnce(new Error("publish failed"));

      const result = await manager.create({
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      });

      expect(result.degraded).toBe(true);
      expect(recordErrorSpy).toHaveBeenCalled();

      recordErrorSpy.mockRestore();
    });
  });

  describe("verify", () => {
    let createdKey!: { key: string; id: string; keyStart: string };
    beforeEach(async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users", "write:users"],
      };
      createdKey = await manager.create(options);
    });

    it("should return ApiKeyPrincipal for valid key", async () => {
      const principal = await manager.verify(createdKey.key);

      expect(principal).not.toBeNull();
      expect(principal?.type).toBe("apikey");
      expect(principal?.id).toBe(createdKey.id);
      expect(principal?.keyId).toBe(createdKey.id);
      expect(principal?.name).toBe("Test Key");
      expect(principal?.tenantId).toBe("tenant_123");
      expect(principal?.permissions).toEqual(["read:users", "write:users"]);
      expect(principal?.keyStart).toBe(createdKey.keyStart);
      expect(principal?.metadata).toEqual({ rateLimit: undefined });
    });

    it("should return null for invalid format", async () => {
      const principal = await manager.verify("invalid_key_format");
      expect(principal).toBeNull();
    });

    it("should return null for non-existent key", async () => {
      const principal = await manager.verify("sk_nonexistent123456_nonexistent123456789012");
      expect(principal).toBeNull();
    });

    it("should return null for key with wrong hash", async () => {
      const parsed = generator.parse(createdKey.key);
      const wrongKey = `${parsed?.prefix}_${parsed?.shortToken}_wronglongtoken1234567890`;

      const principal = await manager.verify(wrongKey);
      expect(principal).toBeNull();
    });

    it("should return null for revoked key", async () => {
      await manager.revoke(createdKey.id);

      const principal = await manager.verify(createdKey.key);
      expect(principal).toBeNull();
    });

    it("should return null for expired key", async () => {
      const keys = mockStore._getKeys();
      const key = Array.from(keys.values())[0];
      key.expiresAt = new Date(Date.now() - 1000);

      const principal = await manager.verify(createdKey.key);
      expect(principal).toBeNull();
    });

    it("should call updateLastUsed on successful verification", async () => {
      await manager.verify(createdKey.key);

      expect(mockStore.updateLastUsed).toHaveBeenCalledWith(createdKey.id);
    });

    it("should allow verification from an allowed IP address", async () => {
      const restrictedKey = await manager.create({
        name: "Restricted Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
        allowedIps: ["192.168.1.1"],
      });

      const principal = await manager.verify(restrictedKey.key, "192.168.1.1");

      expect(principal?.id).toBe(restrictedKey.id);
    });

    it("should throw ForbiddenProblem when IP address is not allowed", async () => {
      const restrictedKey = await manager.create({
        name: "Restricted Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
        allowedIps: ["192.168.1.1"],
      });

      await expect(manager.verify(restrictedKey.key, "10.0.0.1")).rejects.toThrow(ForbiddenProblem);
    });

    it("should skip allowed IP checks when no IP address is provided", async () => {
      const restrictedKey = await manager.create({
        name: "Restricted Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
        allowedIps: ["192.168.1.1"],
      });

      const principal = await manager.verify(restrictedKey.key);

      expect(principal?.id).toBe(restrictedKey.id);
    });

    it("should skip allowed IP checks when key has no allowed IP restrictions", async () => {
      const principal = await manager.verify(createdKey.key, "10.0.0.1");

      expect(principal?.id).toBe(createdKey.id);
    });

    it("should publish ApiKeyUsedEvent on successful verification", async () => {
      mockEventBus.publish.mockClear();
      await manager.verify(createdKey.key);

      expect(mockEventBus.publish).toHaveBeenCalled();
      const publishedEvent = mockEventBus.publish.mock.calls[0][0];
      expect(publishedEvent).toBeInstanceOf(ApiKeyUsedEvent);
      expect(publishedEvent.data.keyId).toBe(createdKey.id);
      expect(publishedEvent.data.tenantId).toBe("tenant_123");
      expect(publishedEvent.data.timestamp).toBeInstanceOf(Date);
    });

    it("should mark verify result as degraded when updateLastUsed fails", async () => {
      const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});
      mockStore.updateLastUsed.mockRejectedValueOnce(new Error("DB error"));

      const principal = await manager.verify(createdKey.key);

      await Promise.resolve();

      expect(principal).not.toBeNull();
      expect(principal?.metadata).toEqual({ rateLimit: undefined, degraded: true });
      expect(recordErrorSpy).toHaveBeenCalled();

      recordErrorSpy.mockRestore();
    });

    it("should not publish event when verification fails", async () => {
      mockEventBus.publish.mockClear();
      await manager.verify("invalid_key");

      expect(mockEventBus.publish).not.toHaveBeenCalled();
    });

    it("should work without EventBus", async () => {
      const managerWithoutBus = new ApiKeyManager(mockStore, generator, hasher);
      const principal = await managerWithoutBus.verify(createdKey.key);
      expect(principal).not.toBeNull();
    });
  });

  describe("revoke", () => {
    it("should revoke an existing key", async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };
      const created = await manager.create(options);

      await manager.revoke(created.id);

      expect(mockStore.revoke).toHaveBeenCalledWith(created.id);
      expect(await manager.revoke(created.id)).toEqual({});
    });

    it("should publish ApiKeyRevokedEvent on success", async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };
      const created = await manager.create(options);

      await manager.revoke(created.id);

      expect(mockEventBus.publish).toHaveBeenCalled();
      const publishedEvent = mockEventBus.publish.mock.calls[1][0];
      expect(publishedEvent).toBeInstanceOf(ApiKeyRevokedEvent);
      expect(publishedEvent.data.keyId).toBe(created.id);
      expect(publishedEvent.data.tenantId).toBe("tenant_123");
      expect(publishedEvent.data.revokedAt).toBeInstanceOf(Date);
    });

    it("should work without EventBus", async () => {
      const managerWithoutBus = new ApiKeyManager(mockStore, generator, hasher);
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };
      const created = await managerWithoutBus.create(options);

      await expect(managerWithoutBus.revoke(created.id)).resolves.toEqual({});

      expect(mockStore.revoke).toHaveBeenCalledWith(created.id);
    });

    it("should mark revoke result as degraded when event publish fails", async () => {
      const options: CreateApiKeyOptions = {
        name: "Test Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };
      const created = await manager.create(options);
      const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});

      mockEventBus.publish.mockRejectedValueOnce(new Error("publish failed"));

      const result = await manager.revoke(created.id);

      expect(result).toEqual({ degraded: true });
      expect(recordErrorSpy).toHaveBeenCalled();

      recordErrorSpy.mockRestore();
    });
  });

  describe("rotate", () => {
    let originalKey!: { key: string; id: string; keyStart: string };

    beforeEach(async () => {
      const options: CreateApiKeyOptions = {
        name: "Production Key",
        tenantId: "tenant_123",
        permissions: ["read:users", "write:users"],
        prefix: "pk",
        rateLimit: { limit: 1000, duration: 60 },
      };
      originalKey = await manager.create(options);
    });

    it("should create a new key and revoke the old one", async () => {
      const result = await manager.rotate(originalKey.id, { idempotencyKey: "rotation-1" });

      expect(result.key).not.toBe(originalKey.key);
      expect(result.id).not.toBe(originalKey.id);
      expect(result.keyStart).toMatch(/^pk_[a-zA-Z0-9_~-]{8}\.\.\.$/);

      expect(mockStore.rotate).toHaveBeenCalled();
    });

    it("should preserve original key properties", async () => {
      await manager.rotate(originalKey.id, { idempotencyKey: "rotation-1" });

      const rotationCall = mockStore.rotate.mock.calls[0][0];
      const replacement = await mockStore.findById(rotationCall.replacement.id);
      expect(replacement?.name).toBe("Production Key");
      expect(replacement?.tenantId).toBe("tenant_123");
      expect(replacement?.permissions).toEqual(["read:users", "write:users"]);
      expect(replacement?.prefix).toBe("pk");
      expect(replacement?.rateLimit).toEqual({ limit: 1000, duration: 60 });
    });

    it("should throw error for non-existent key", async () => {
      await expect(
        manager.rotate("nonexistent_id", { idempotencyKey: "rotation-missing" }),
      ).rejects.toThrow("API Key with id 'nonexistent_id' not found");
    });

    it("should publish ApiKeyRotatedEvent on success", async () => {
      const result = await manager.rotate(originalKey.id, { idempotencyKey: "rotation-event" });

      expect(mockEventBus.publish).toHaveBeenCalled();
      const publishedEvent = mockEventBus.publish.mock.calls[1][0];
      expect(publishedEvent).toBeInstanceOf(ApiKeyRotatedEvent);
      expect(publishedEvent.data.oldKeyId).toBe(originalKey.id);
      expect(publishedEvent.data.newKeyId).toBe(result.id);
      expect(publishedEvent.data.tenantId).toBe("tenant_123");
    });

    it("should work without EventBus", async () => {
      const managerWithoutBus = new ApiKeyManager(
        mockStore,
        generator,
        hasher,
        undefined,
        undefined,
        rotationProtector,
      );
      const options: CreateApiKeyOptions = {
        name: "Production Key",
        tenantId: "tenant_123",
        permissions: ["read:users"],
        prefix: "pk",
      };
      const createdKey = await managerWithoutBus.create(options);

      const result = await managerWithoutBus.rotate(createdKey.id, {
        idempotencyKey: "rotation-no-bus",
      });

      expect(result.key).not.toBe(createdKey.key);
      expect(result.id).not.toBe(createdKey.id);
      expect(result.degraded).toBeUndefined();
    });

    it("should mark rotate result as degraded when publish fails", async () => {
      const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});
      mockEventBus.publish.mockReset();
      mockEventBus.publish.mockRejectedValueOnce(new Error("publish failed"));

      const result = await manager.rotate(originalKey.id, {
        idempotencyKey: "rotation-publish-failure",
      });

      await Promise.resolve();

      expect(result.id).toBeDefined();
      expect(result.degraded).toBe(true);
      expect(recordErrorSpy).toHaveBeenCalled();

      recordErrorSpy.mockRestore();
    });

    it("should return the same replacement for an idempotent retry", async () => {
      const first = await manager.rotate(originalKey.id, {
        idempotencyKey: "rotation-replay",
      });
      const second = await manager.rotate(originalKey.id, {
        idempotencyKey: "rotation-replay",
      });

      expect(second).toEqual(first);
      expect(mockStore._getKeys().size).toBe(2);
      expect(
        Array.from(mockStore._getKeys().values()).filter((key) => !key.revokedAt),
      ).toHaveLength(1);
    });

    it("should recover a pending rotation event with its stable identity", async () => {
      const recordErrorSpy = vi.spyOn(telemetry, "recordError").mockImplementation(() => {});
      mockEventBus.publish.mockReset();
      mockEventBus.publish
        .mockRejectedValueOnce(new Error("publish failed"))
        .mockResolvedValueOnce(undefined);

      const first = await manager.rotate(originalKey.id, {
        idempotencyKey: "rotation-event-recovery",
      });
      const firstEvent = mockEventBus.publish.mock.calls[0][0] as ApiKeyRotatedEvent;
      const second = await manager.rotate(originalKey.id, {
        idempotencyKey: "rotation-event-recovery",
      });
      const secondEvent = mockEventBus.publish.mock.calls[1][0] as ApiKeyRotatedEvent;

      expect(first.degraded).toBe(true);
      expect(second.degraded).toBeUndefined();
      expect(second.key).toBe(first.key);
      expect(second.id).toBe(first.id);
      expect(secondEvent.eventId).toBe(firstEvent.eventId);
      expect(secondEvent.timestamp).toEqual(firstEvent.timestamp);
      expect(mockStore.releaseRotationEvent).toHaveBeenCalledTimes(1);
      expect(mockStore.completeRotationEvent).toHaveBeenCalledTimes(1);

      recordErrorSpy.mockRestore();
    });

    it("should reject a second logical rotation without creating another active key", async () => {
      await manager.rotate(originalKey.id, { idempotencyKey: "rotation-winner" });

      await expect(
        manager.rotate(originalKey.id, { idempotencyKey: "rotation-loser" }),
      ).rejects.toThrow(ApiKeyRotationConflictProblem);
      expect(mockStore._getKeys().size).toBe(2);
      expect(
        Array.from(mockStore._getKeys().values()).filter((key) => !key.revokedAt),
      ).toHaveLength(1);
    });

    it("should persist only protected recovery material", async () => {
      const result = await manager.rotate(originalKey.id, {
        idempotencyKey: "rotation-protected",
      });
      const input = mockStore.rotate.mock.calls[0][0];
      const parsed = generator.parse(result.key);

      expect(input.recoveryCiphertext).not.toContain(result.key);
      expect(input.recoveryCiphertext).not.toContain(parsed?.longToken);
      expect(JSON.stringify(input.replacement)).not.toContain(result.key);
      expect(input.replacement.hash).toHaveLength(64);
    });

    it("should fail closed when rotation protection is not configured", async () => {
      const managerWithoutProtector = new ApiKeyManager(
        mockStore,
        generator,
        hasher,
        mockEventBus as unknown as EventBus,
      );

      await expect(
        managerWithoutProtector.rotate(originalKey.id, {
          idempotencyKey: "rotation-without-protector",
        }),
      ).rejects.toThrow("API key rotation recovery material could not be protected");
      expect(mockStore.rotate).not.toHaveBeenCalled();
    });

    it.each(["", "   ", "x".repeat(256)])(
      "should reject invalid rotation idempotency key %j",
      async (idempotencyKey) => {
        await expect(manager.rotate(originalKey.id, { idempotencyKey })).rejects.toThrow(
          "API key rotation idempotency key must contain between 1 and 255 characters",
        );
        expect(mockStore.rotate).not.toHaveBeenCalled();
      },
    );
  });

  describe("list", () => {
    beforeEach(async () => {
      const options1: CreateApiKeyOptions = {
        name: "Key 1",
        tenantId: "tenant_123",
        permissions: ["read:users"],
      };
      const options2: CreateApiKeyOptions = {
        name: "Key 2",
        tenantId: "tenant_123",
        permissions: ["write:users"],
      };
      const options3: CreateApiKeyOptions = {
        name: "Key 3",
        tenantId: "tenant_456",
        permissions: ["read:orders"],
      };

      await manager.create(options1);
      await manager.create(options2);
      await manager.create(options3);
    });

    it("should list keys for a specific tenant", async () => {
      const keys = await manager.list("tenant_123");

      expect(keys).toHaveLength(2);
      expect(keys[0].tenantId).toBe("tenant_123");
      expect(keys[1].tenantId).toBe("tenant_123");
    });

    it("should exclude hash field from results", async () => {
      const keys = await manager.list("tenant_123");

      for (const key of keys) {
        expect(key).not.toHaveProperty("hash");
      }
    });

    it("should return empty array for tenant with no keys", async () => {
      const keys = await manager.list("tenant_999");

      expect(keys).toHaveLength(0);
    });
  });
});
