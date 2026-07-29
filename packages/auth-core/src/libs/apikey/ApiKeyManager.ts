import { randomUUID } from "node:crypto";
import type { EventBus } from "@croco/events-core";
import type { Logger } from "@croco/framework-logger";
import { recordError } from "@croco/telemetry-api";
import {
  ApiKeyCreatedEvent,
  ApiKeyRevokedEvent,
  ApiKeyRotatedEvent,
  ApiKeyUsedEvent,
} from "../events/ApiKeyEvents";
import type {
  ApiKey,
  CreateApiKeyOptions,
  CreateApiKeyResult,
  RevokeApiKeyResult,
  RotateApiKeyOptions,
  RotateApiKeyResult,
} from "../interfaces/ApiKey";
import type { ApiKeyPrincipal } from "../interfaces/Principal";
import {
  ForbiddenProblem,
  InvalidApiKeyRotationIdempotencyKeyProblem,
} from "../problems/AuthProblems";
import { ApiKeyGenerator } from "./ApiKeyGenerator";
import { ApiKeyHasher } from "./ApiKeyHasher";
import {
  ApiKeyRotationProtectionProblem,
  type ApiKeyRotationProtector,
} from "./ApiKeyRotationProtector";
import type { ApiKeyStore } from "./ApiKeyStore";
import { ApiKeyNotFoundProblem } from "./problems/ApiKeyNotFoundProblem";

const ROTATION_EVENT_CLAIM_LEASE_MS = 5 * 60 * 1000;

export class ApiKeyManager {
  constructor(
    private readonly store: ApiKeyStore,
    private readonly generator: ApiKeyGenerator = new ApiKeyGenerator(),
    private readonly hasher: ApiKeyHasher = new ApiKeyHasher(),
    private readonly eventBus?: EventBus,
    private readonly logger?: Logger,
    private readonly rotationProtector?: ApiKeyRotationProtector,
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
    const {
      prefix = "sk",
      shortToken,
      longToken,
      fullKey,
    } = this.generator.generate(options.prefix);
    const hash = this.hasher.hash(longToken);

    const key = await this.store.save({
      prefix,
      shortToken,
      hash,
      name: options.name,
      tenantId: options.tenantId,
      permissions: options.permissions,
      createdBy: "system",
      expiresAt: options.expiresAt ?? null,
      revokedAt: null,
      lastUsedAt: null,
      rateLimit: options.rateLimit,
      allowedIps: options.allowedIps,
    });

    const degraded = this.eventBus
      ? await this.runSideEffect(
          "ApiKeyCreatedEvent publish failed",
          this.eventBus.publish(
            new ApiKeyCreatedEvent({ keyId: key.id, tenantId: key.tenantId, name: key.name }),
          ),
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
      throw new ForbiddenProblem("API key is not allowed from this IP address");
    }

    const degradedStates = await Promise.all([
      this.runSideEffect("ApiKey updateLastUsed failed", this.store.updateLastUsed(keyData.id)),
      this.eventBus
        ? this.runSideEffect(
            "ApiKeyUsedEvent publish failed",
            this.eventBus.publish(
              new ApiKeyUsedEvent({
                keyId: keyData.id,
                tenantId: keyData.tenantId,
                timestamp: new Date(),
              }),
            ),
          )
        : Promise.resolve(false),
    ]);

    const degraded = degradedStates.some(Boolean);

    return {
      type: "apikey",
      id: keyData.id,
      keyId: keyData.id,
      name: keyData.name,
      keyStart: `${keyData.prefix}_${keyData.shortToken.slice(0, 8)}...`,
      tenantId: keyData.tenantId,
      permissions: keyData.permissions,
      metadata: degraded
        ? { rateLimit: keyData.rateLimit, degraded: true }
        : { rateLimit: keyData.rateLimit },
    };
  }

  async revoke(id: string): Promise<RevokeApiKeyResult> {
    const keyData = await this.store.findById(id);
    await this.store.revoke(id);

    let degraded = false;

    if (keyData) {
      degraded = this.eventBus
        ? await this.runSideEffect(
            "ApiKeyRevokedEvent publish failed",
            this.eventBus.publish(
              new ApiKeyRevokedEvent({
                keyId: id,
                tenantId: keyData.tenantId,
                revokedAt: new Date(),
              }),
            ),
          )
        : false;
    }

    return degraded ? { degraded: true } : {};
  }

  async rotate(id: string, options: RotateApiKeyOptions): Promise<RotateApiKeyResult> {
    if (options.idempotencyKey.trim().length === 0 || options.idempotencyKey.length > 255) {
      throw new InvalidApiKeyRotationIdempotencyKeyProblem();
    }

    const existingKey = await this.store.findById(id);
    if (!existingKey) {
      throw new ApiKeyNotFoundProblem(id);
    }
    if (!this.rotationProtector) {
      throw new ApiKeyRotationProtectionProblem("configure", "missing");
    }

    const {
      prefix = "sk",
      shortToken,
      longToken,
      fullKey,
    } = this.generator.generate(existingKey.prefix);
    const hash = this.hasher.hash(longToken);
    const newKeyId = randomUUID();
    const protectionContext = {
      oldKeyId: id,
      newKeyId,
      tenantId: existingKey.tenantId,
      idempotencyKey: options.idempotencyKey,
    };
    const event = new ApiKeyRotatedEvent({
      oldKeyId: id,
      newKeyId,
      tenantId: existingKey.tenantId,
    });
    const rotation = await this.store.rotate({
      oldKeyId: id,
      replacement: {
        id: newKeyId,
        prefix,
        shortToken,
        hash,
      },
      tenantId: existingKey.tenantId,
      idempotencyKey: options.idempotencyKey,
      recoveryCiphertext: this.rotationProtector.encrypt(fullKey, protectionContext),
      eventStatus: this.eventBus ? "pending" : "completed",
      eventClaimId: null,
      eventClaimExpiresAt: null,
      eventId: event.eventId,
      eventOccurredAt: event.timestamp,
    });

    const recoveredKey = this.rotationProtector.decrypt(rotation.recoveryCiphertext, {
      oldKeyId: rotation.oldKeyId,
      newKeyId: rotation.replacement.id,
      tenantId: rotation.tenantId,
      idempotencyKey: rotation.idempotencyKey,
    });

    const degraded = this.eventBus ? await this.publishRotationEvent(rotation) : false;

    return {
      key: recoveredKey,
      id: rotation.replacement.id,
      keyStart: `${rotation.replacement.prefix}_${rotation.replacement.shortToken.slice(0, 8)}...`,
      degraded: degraded || undefined,
    };
  }

  private async publishRotationEvent(
    rotation: Awaited<ReturnType<ApiKeyStore["rotate"]>>,
  ): Promise<boolean> {
    if (!this.eventBus || rotation.eventStatus === "completed") {
      return false;
    }

    const claimId = randomUUID();
    const claimed = await this.store.claimRotationEvent(
      rotation.oldKeyId,
      rotation.idempotencyKey,
      claimId,
      new Date(Date.now() + ROTATION_EVENT_CLAIM_LEASE_MS),
    );
    if (!claimed) {
      return true;
    }

    try {
      const event = new ApiKeyRotatedEvent({
        oldKeyId: claimed.oldKeyId,
        newKeyId: claimed.replacement.id,
        tenantId: claimed.tenantId,
      });
      const eventIdentity = event as unknown as {
        eventId: string;
        timestamp: Date;
      };
      eventIdentity.eventId = claimed.eventId;
      eventIdentity.timestamp = new Date(claimed.eventOccurredAt);
      await this.eventBus.publish(event);
      const completed = await this.store.completeRotationEvent(
        claimed.oldKeyId,
        claimed.idempotencyKey,
        claimId,
      );
      return completed?.eventStatus !== "completed";
    } catch (error: unknown) {
      recordError(error);
      this.logger?.warn("ApiKeyRotatedEvent publish failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      try {
        await this.store.releaseRotationEvent(claimed.oldKeyId, claimed.idempotencyKey, claimId);
      } catch (releaseError: unknown) {
        recordError(releaseError);
        this.logger?.warn("ApiKeyRotatedEvent claim release failed", {
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        });
      }
      return true;
    }
  }

  async list(tenantId: string): Promise<Omit<ApiKey, "hash">[]> {
    const keys = await this.store.listByTenant(tenantId);
    return keys.map(({ hash: _hash, ...rest }) => rest);
  }
}
