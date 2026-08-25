import type { AuthUser, TenantMappingProvider } from "@croco/auth-core";
import type { TenantResolver } from "@croco/tenant-core";

import {
  DuplicateTenantMappingProblem,
  UnexpectedTenantMappingClaimProblem,
} from "./problems/ClerkProblems";

export type TenantMappingClaimResult =
  | { readonly outcome: "created" }
  | { readonly outcome: "existing"; readonly tenantId: string };

export interface TenantMappingStore {
  get(externalOrgId: string): Promise<string | null>;

  /**
   * Creates the mapping only when the organization is unclaimed and returns the authoritative tenant.
   * Implementations must make the absence check and create one atomic operation across processes.
   */
  claim(externalOrgId: string, tenantId: string): Promise<TenantMappingClaimResult>;
  delete(externalOrgId: string): Promise<void>;
}

export class InMemoryTenantMappingStore implements TenantMappingStore {
  constructor(private readonly mappings: Map<string, string> = new Map()) {}

  async get(externalOrgId: string): Promise<string | null> {
    return this.mappings.get(externalOrgId) ?? null;
  }

  async claim(externalOrgId: string, tenantId: string): Promise<TenantMappingClaimResult> {
    const existingTenantId = this.mappings.get(externalOrgId);
    if (existingTenantId !== undefined) {
      return { outcome: "existing", tenantId: existingTenantId };
    }

    this.mappings.set(externalOrgId, tenantId);
    return { outcome: "created" };
  }

  async delete(externalOrgId: string): Promise<void> {
    this.mappings.delete(externalOrgId);
  }
}

export type ClerkTenantRequest = {
  user?: AuthUser;
};

export class ClerkTenantMapper
  implements TenantMappingProvider, TenantResolver<ClerkTenantRequest>
{
  constructor(private readonly store: TenantMappingStore = new InMemoryTenantMappingStore()) {}

  async resolve(requestOrOrgId: string | ClerkTenantRequest): Promise<string | null> {
    if (typeof requestOrOrgId === "string") {
      return this.resolveByOrgId(requestOrOrgId);
    }
    return this.resolveByRequest(requestOrOrgId);
  }

  async register(externalOrgId: string, tenantId: string): Promise<void> {
    const claim = await this.store.claim(externalOrgId, tenantId);
    switch (claim.outcome) {
      case "created":
        return;
      case "existing":
        if (claim.tenantId === tenantId) {
          return;
        }

        throw new DuplicateTenantMappingProblem(externalOrgId, claim.tenantId, tenantId);
      default: {
        const exhaustiveClaim: never = claim;
        throw new UnexpectedTenantMappingClaimProblem(exhaustiveClaim);
      }
    }
  }

  async remove(externalOrgId: string): Promise<void> {
    await this.store.delete(externalOrgId);
  }

  private async resolveByOrgId(externalOrgId: string): Promise<string | null> {
    return this.store.get(externalOrgId);
  }

  private async resolveByRequest(request: ClerkTenantRequest): Promise<string | null> {
    const orgId = request.user?.metadata?.orgId;

    if (typeof orgId === "string") {
      return this.resolveByOrgId(orgId);
    }

    return null;
  }
}
