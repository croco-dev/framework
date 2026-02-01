export interface TenantMappingProvider {
  resolve(externalOrgId: string): Promise<string | null>;
  register(externalOrgId: string, tenantId: string): Promise<void>;
  remove(externalOrgId: string): Promise<void>;
}
