import type { EventBus } from '@croco/events-core';
import { ApiKeyCreatedEvent, ApiKeyRevokedEvent, ApiKeyRotatedEvent, ApiKeyUsedEvent } from '../events/ApiKeyEvents';
import type { ApiKey, CreateApiKeyOptions, CreateApiKeyResult, RotateApiKeyResult } from '../interfaces/ApiKey';
import type { ApiKeyPrincipal } from '../interfaces/Principal';
import { ApiKeyGenerator } from './ApiKeyGenerator';
import { ApiKeyHasher } from './ApiKeyHasher';
import type { ApiKeyStore } from './ApiKeyStore';

export class ApiKeyManager {
  constructor(
    private readonly store: ApiKeyStore,
    private readonly generator: ApiKeyGenerator = new ApiKeyGenerator(),
    private readonly hasher: ApiKeyHasher = new ApiKeyHasher(),
    private readonly eventBus?: EventBus
  ) {}

  async create(options: CreateApiKeyOptions): Promise<CreateApiKeyResult> {
    const { prefix = 'sk', shortToken, longToken, fullKey } = this.generator.generate(options.prefix);
    const hash = this.hasher.hash(longToken);

    const key = await this.store.save({
      prefix,
      shortToken,
      hash,
      name: options.name,
      tenantId: options.tenantId,
      permissions: options.permissions,
      createdBy: 'system',
      expiresAt: options.expiresAt ?? null,
      revokedAt: null,
      lastUsedAt: null,
      rateLimit: options.rateLimit,
      allowedIps: options.allowedIps,
    });

    this.eventBus
      ?.publish(new ApiKeyCreatedEvent({ keyId: key.id, tenantId: key.tenantId, name: key.name }))
      .catch(() => {});

    return {
      key: fullKey,
      id: key.id,
      keyStart: `${prefix}_${shortToken.slice(0, 8)}...`,
    };
  }

  async verify(rawKey: string): Promise<ApiKeyPrincipal | null> {
    const parsed = this.generator.parse(rawKey);
    if (!parsed) return null;

    const { prefix, shortToken, longToken } = parsed;
    const keyData = await this.store.findByShortToken(shortToken);

    if (!keyData) return null;
    if (keyData.prefix !== prefix) return null;
    if (!this.hasher.verify(longToken, keyData.hash)) return null;
    if (keyData.revokedAt) return null;
    if (keyData.expiresAt && keyData.expiresAt < new Date()) return null;

    this.store.updateLastUsed(keyData.id).catch(() => {
      // 실패 무시 - 사용 기록 업데이트는 인증 결과에 영향하지 않음
    });

    this.eventBus
      ?.publish(new ApiKeyUsedEvent({ keyId: keyData.id, tenantId: keyData.tenantId, timestamp: new Date() }))
      .catch(() => {});

    return {
      type: 'apikey',
      id: keyData.id,
      keyId: keyData.id,
      name: keyData.name,
      keyStart: `${keyData.prefix}_${keyData.shortToken.slice(0, 8)}...`,
      tenantId: keyData.tenantId,
      permissions: keyData.permissions,
      metadata: { rateLimit: keyData.rateLimit },
    };
  }

  async revoke(id: string): Promise<void> {
    const keyData = await this.store.findById(id);
    await this.store.revoke(id);

    if (keyData) {
      this.eventBus
        ?.publish(new ApiKeyRevokedEvent({ keyId: id, tenantId: keyData.tenantId, revokedAt: new Date() }))
        .catch(() => {});
    }
  }

  async rotate(id: string): Promise<RotateApiKeyResult> {
    const existingKey = await this.store.findById(id);
    if (!existingKey) {
      throw new Error(`API Key with id '${id}' not found`);
    }

    const { prefix = 'sk', shortToken, longToken, fullKey } = this.generator.generate(existingKey.prefix);
    const hash = this.hasher.hash(longToken);

    const newKey = await this.store.save({
      prefix,
      shortToken,
      hash,
      name: existingKey.name,
      tenantId: existingKey.tenantId,
      permissions: existingKey.permissions,
      createdBy: existingKey.createdBy,
      expiresAt: existingKey.expiresAt,
      revokedAt: null,
      lastUsedAt: null,
      rateLimit: existingKey.rateLimit,
      allowedIps: existingKey.allowedIps,
    });

    await this.store.revoke(id);

    this.eventBus
      ?.publish(new ApiKeyRotatedEvent({ oldKeyId: id, newKeyId: newKey.id, tenantId: existingKey.tenantId }))
      .catch(() => {});

    return {
      key: fullKey,
      id: newKey.id,
      keyStart: `${prefix}_${shortToken.slice(0, 8)}...`,
    };
  }

  async list(tenantId: string): Promise<Omit<ApiKey, 'hash'>[]> {
    const keys = await this.store.listByTenant(tenantId);
    return keys.map(({ hash, ...rest }) => rest);
  }
}
