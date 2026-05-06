import type { EventBus } from '@croco/events-core';
import type { Logger } from '@croco/framework-logger';
import { recordError } from '@croco/telemetry-api';
import { ApiKeyCreatedEvent, ApiKeyRevokedEvent, ApiKeyRotatedEvent, ApiKeyUsedEvent } from '../events/ApiKeyEvents';
import type {
  ApiKey,
  CreateApiKeyOptions,
  CreateApiKeyResult,
  RevokeApiKeyResult,
  RotateApiKeyResult,
} from '../interfaces/ApiKey';
import type { ApiKeyPrincipal } from '../interfaces/Principal';
import { ForbiddenProblem } from '../problems/AuthProblems';
import { ApiKeyGenerator } from './ApiKeyGenerator';
import { ApiKeyHasher } from './ApiKeyHasher';
import type { ApiKeyStore } from './ApiKeyStore';
import { ApiKeyNotFoundProblem } from './problems/ApiKeyNotFoundProblem';

export class ApiKeyManager {
  constructor(
    private readonly store: ApiKeyStore,
    private readonly generator: ApiKeyGenerator = new ApiKeyGenerator(),
    private readonly hasher: ApiKeyHasher = new ApiKeyHasher(),
    private readonly eventBus?: EventBus,
    private readonly logger?: Logger
  ) {}

  private async runSideEffect(effectName: string, effect: Promise<void>): Promise<boolean> {
    try {
      await effect;
      return false;
    } catch (err: unknown) {
      recordError(err);
      this.logger?.warn(effectName, {
        error: err instanceof Error ? err.message : String(err),
      });
      return true;
    }
  }

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

    const degraded = this.eventBus
      ? await this.runSideEffect(
          'ApiKeyCreatedEvent publish failed',
          this.eventBus.publish(new ApiKeyCreatedEvent({ keyId: key.id, tenantId: key.tenantId, name: key.name }))
        )
      : false;

    return {
      key: fullKey,
      id: key.id,
      keyStart: `${prefix}_${shortToken.slice(0, 8)}...`,
      degraded: degraded || undefined,
    };
  }

  async verify(rawKey: string, ip?: string): Promise<ApiKeyPrincipal | null> {
    const parsed = this.generator.parse(rawKey);
    if (!parsed) return null;

    const { prefix, shortToken, longToken } = parsed;
    const keyData = await this.store.findByShortToken(shortToken);

    if (!keyData) return null;
    if (keyData.prefix !== prefix) return null;
    if (!this.hasher.verify(longToken, keyData.hash)) return null;
    if (keyData.revokedAt) return null;
    if (keyData.expiresAt && keyData.expiresAt < new Date()) return null;
    if (ip && keyData.allowedIps && !keyData.allowedIps.includes(ip)) {
      throw new ForbiddenProblem('API key is not allowed from this IP address');
    }

    const degradedStates = await Promise.all([
      this.runSideEffect('ApiKey updateLastUsed failed', this.store.updateLastUsed(keyData.id)),
      this.eventBus
        ? this.runSideEffect(
            'ApiKeyUsedEvent publish failed',
            this.eventBus.publish(
              new ApiKeyUsedEvent({ keyId: keyData.id, tenantId: keyData.tenantId, timestamp: new Date() })
            )
          )
        : Promise.resolve(false),
    ]);

    const degraded = degradedStates.some(Boolean);

    return {
      type: 'apikey',
      id: keyData.id,
      keyId: keyData.id,
      name: keyData.name,
      keyStart: `${keyData.prefix}_${keyData.shortToken.slice(0, 8)}...`,
      tenantId: keyData.tenantId,
      permissions: keyData.permissions,
      metadata: degraded ? { rateLimit: keyData.rateLimit, degraded: true } : { rateLimit: keyData.rateLimit },
    };
  }

  async revoke(id: string): Promise<RevokeApiKeyResult> {
    const keyData = await this.store.findById(id);
    await this.store.revoke(id);

    let degraded = false;

    if (keyData) {
      degraded = this.eventBus
        ? await this.runSideEffect(
            'ApiKeyRevokedEvent publish failed',
            this.eventBus.publish(
              new ApiKeyRevokedEvent({ keyId: id, tenantId: keyData.tenantId, revokedAt: new Date() })
            )
          )
        : false;
    }

    return degraded ? { degraded: true } : {};
  }

  async rotate(id: string): Promise<RotateApiKeyResult> {
    const existingKey = await this.store.findById(id);
    if (!existingKey) {
      throw new ApiKeyNotFoundProblem(id);
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

    const degraded = this.eventBus
      ? await this.runSideEffect(
          'ApiKeyRotatedEvent publish failed',
          this.eventBus.publish(
            new ApiKeyRotatedEvent({ oldKeyId: id, newKeyId: newKey.id, tenantId: existingKey.tenantId })
          )
        )
      : false;

    return {
      key: fullKey,
      id: newKey.id,
      keyStart: `${prefix}_${shortToken.slice(0, 8)}...`,
      degraded: degraded || undefined,
    };
  }

  async list(tenantId: string): Promise<Omit<ApiKey, 'hash'>[]> {
    const keys = await this.store.listByTenant(tenantId);
    return keys.map(({ hash, ...rest }) => rest);
  }
}
