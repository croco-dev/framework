import { Token } from "@croco/framework-context";
import type { ApiKey, ApiKeyRotation, ApiKeyRotationInput } from "../interfaces/ApiKey";

export abstract class ApiKeyStore {
  abstract findById(id: string): Promise<ApiKey | null>;
  abstract findByShortToken(shortToken: string): Promise<ApiKey | null>;
  abstract save(key: Omit<ApiKey, "id" | "createdAt">): Promise<ApiKey>;
  abstract rotate(input: ApiKeyRotationInput): Promise<ApiKeyRotation>;
  abstract claimRotationEvent(
    oldKeyId: string,
    idempotencyKey: string,
    claimId: string,
    claimExpiresAt: Date,
  ): Promise<ApiKeyRotation | null>;
  abstract completeRotationEvent(
    oldKeyId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<ApiKeyRotation | null>;
  abstract releaseRotationEvent(
    oldKeyId: string,
    idempotencyKey: string,
    claimId: string,
  ): Promise<void>;
  abstract updateLastUsed(id: string): Promise<void>;
  abstract revoke(id: string): Promise<void>;
  abstract listByTenant(tenantId: string): Promise<ApiKey[]>;
  abstract delete(id: string): Promise<void>;
}

export const API_KEY_STORE_TOKEN = new Token<ApiKeyStore>("ApiKeyStore");
