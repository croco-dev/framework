import type { DomainPolicy } from "./types";

export abstract class DomainPolicyStore {
  abstract findByTenantAndDomain(tenantId: string, domain: string): Promise<DomainPolicy | null>;
  abstract findAllByTenant(tenantId: string): Promise<DomainPolicy[]>;
  abstract save(policy: DomainPolicy): Promise<DomainPolicy>;
  abstract delete(tenantId: string, domain: string): Promise<void>;
}
