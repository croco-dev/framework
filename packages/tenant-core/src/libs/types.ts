/**
 * Tenant status
 */
export type TenantStatus = 'active' | 'inactive' | 'suspended' | 'trial' | 'expired';

/**
 * Tenant context stored in AsyncLocalStorage
 */
export type TenantContext = {
  tenantId: string;
  tenant?: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
  };
};

/**
 * Tenant identification method
 */
export type TenantIdentificationMethod = 'header' | 'subdomain' | 'jwt' | 'custom';

/**
 * Tenant resolution result
 */
export type TenantResolutionResult =
  | {
      found: true;
      tenantId: string;
      method: TenantIdentificationMethod;
    }
  | {
      found: false;
      tenantId: null;
      method: null;
    };
