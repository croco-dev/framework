import { Token } from '@croco/framework-context';
import type { ApiKey } from '../interfaces/ApiKey';

export interface ApiKeyStore {
  findById(id: string): Promise<ApiKey | null>;
  findByShortToken(shortToken: string): Promise<ApiKey | null>;
  save(key: Omit<ApiKey, 'id' | 'createdAt'>): Promise<ApiKey>;
  updateLastUsed(id: string): Promise<void>;
  revoke(id: string): Promise<void>;
  listByTenant(tenantId: string): Promise<ApiKey[]>;
  delete(id: string): Promise<void>;
}

export const API_KEY_STORE_TOKEN = new Token<ApiKeyStore>('ApiKeyStore');
