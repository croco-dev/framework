import { Token } from "@croco/framework-context";
import type { ApiKey } from "../interfaces/ApiKey";

export abstract class ApiKeyStore {
  abstract findById(id: string): Promise<ApiKey | null>;
  abstract findByShortToken(shortToken: string): Promise<ApiKey | null>;
  abstract save(key: Omit<ApiKey, "id" | "createdAt">): Promise<ApiKey>;
  abstract updateLastUsed(id: string): Promise<void>;
  abstract revoke(id: string): Promise<void>;
  abstract listByTenant(tenantId: string): Promise<ApiKey[]>;
  abstract delete(id: string): Promise<void>;
}

export const API_KEY_STORE_TOKEN = new Token<ApiKeyStore>("ApiKeyStore");
