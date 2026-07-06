export type AuthUser = {
  id: string;
  email?: string;
  tenantId?: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, unknown>;
};
