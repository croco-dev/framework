export type PrincipalType = 'user' | 'apikey' | 'service';

export type Principal = {
  type: PrincipalType;
  id: string;
  permissions: string[];
  tenantId?: string;
  metadata?: Record<string, unknown>;
};

export type UserPrincipal = Principal & {
  type: 'user';
  email?: string;
  roles: string[];
};

export type ApiKeyPrincipal = Principal & {
  type: 'apikey';
  keyId: string;
  name: string;
  keyStart: string;
};
