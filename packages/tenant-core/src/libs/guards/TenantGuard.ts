import type { Tenant } from "../TenantStore";

export interface TenantGuard {
  /**
   * Check if the tenant is allowed
   * @param tenant - The resolved tenant
   * @returns True if allowed, false otherwise
   */
  canAccess(tenant: Tenant): boolean;

  /**
   * Get the guard name
   * @returns The guard name
   */
  getName(): string;
}

export type ActiveTenantGuardOptions = {
  allowedStatuses?: Array<"active" | "trial">;
};

export class ActiveTenantGuard implements TenantGuard {
  private readonly allowedStatuses: Array<"active" | "trial">;

  constructor(options: ActiveTenantGuardOptions = {}) {
    this.allowedStatuses = options.allowedStatuses ?? ["active", "trial"];
  }

  canAccess(tenant: Tenant): boolean {
    return this.allowedStatuses.includes(tenant.status as "active" | "trial");
  }

  getName(): string {
    return "ActiveTenantGuard";
  }
}
