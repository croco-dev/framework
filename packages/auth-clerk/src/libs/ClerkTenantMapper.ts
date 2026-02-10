import type { AuthUser, TenantMappingProvider } from '@croco/auth-core';
import type { TenantResolver } from '@croco/tenant-core';

export interface TenantMappingStore {
  get(externalOrgId: string): Promise<string | null>;
  set(externalOrgId: string, tenantId: string): Promise<void>;
  delete(externalOrgId: string): Promise<void>;
}

export class ClerkTenantMapper implements TenantMappingProvider, TenantResolver<Request> {
  private inMemoryStore = new Map<string, string>();

  constructor(private store?: TenantMappingStore) {}

  async resolve(requestOrOrgId: string | Request): Promise<string | null> {
    if (typeof requestOrOrgId === 'string') {
      return this.resolveByOrgId(requestOrOrgId);
    }
    return this.resolveByRequest(requestOrOrgId);
  }

  async register(externalOrgId: string, tenantId: string): Promise<void> {
    if (this.store) {
      await this.store.set(externalOrgId, tenantId);
    } else {
      this.inMemoryStore.set(externalOrgId, tenantId);
    }
  }

  async remove(externalOrgId: string): Promise<void> {
    if (this.store) {
      await this.store.delete(externalOrgId);
    } else {
      this.inMemoryStore.delete(externalOrgId);
    }
  }

  private async resolveByOrgId(externalOrgId: string): Promise<string | null> {
    if (this.store) {
      return this.store.get(externalOrgId);
    }
    return this.inMemoryStore.get(externalOrgId) ?? null;
  }

  private async resolveByRequest(request: Request): Promise<string | null> {
    const authUser = (request as unknown as { user?: AuthUser }).user;
    const orgId = authUser?.metadata?.orgId;

    if (typeof orgId === 'string') {
      return this.resolveByOrgId(orgId);
    }

    return null;
  }
}
