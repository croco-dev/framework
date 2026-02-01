export type AuthUser = {
  id: string;
  email?: string;
  roles: string[];
  permissions: string[];
  metadata?: Record<string, unknown>;
};
