import { DomainPolicyStore } from "./DomainPolicyStore";
import type { DomainPolicy } from "./types";

export class InMemoryDomainPolicyStore extends DomainPolicyStore {
  private readonly storage = new Map<string, DomainPolicy>();

  async findByTenantAndDomain(tenantId: string, domain: string): Promise<DomainPolicy | null> {
    return this.storage.get(this.getKey(tenantId, domain)) ?? null;
  }

  async findAllByTenant(tenantId: string): Promise<DomainPolicy[]> {
    return [...this.storage.values()].filter((policy) => policy.tenantId === tenantId);
  }

  async save(policy: DomainPolicy): Promise<DomainPolicy> {
    const key = this.getKey(policy.tenantId, policy.domain);
    this.storage.set(key, policy);
    return policy;
  }

  async delete(tenantId: string, domain: string): Promise<void> {
    const key = this.getKey(tenantId, domain);
    this.storage.delete(key);
  }

  private getKey(tenantId: string, domain: string): string {
    return JSON.stringify([tenantId, domain]);
  }
}
