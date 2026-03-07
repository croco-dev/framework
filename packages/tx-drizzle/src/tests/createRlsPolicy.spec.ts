import { describe, expect, it } from 'vitest';
import { createRlsPolicy } from '../libs/createRlsPolicy';

describe('createRlsPolicy', () => {
  it('should generate default PostgreSQL RLS policy SQL', () => {
    const sql = createRlsPolicy({ tableName: 'users' });

    expect(sql).toContain('ALTER TABLE users ENABLE ROW LEVEL SECURITY;');
    expect(sql).toContain('CREATE POLICY users_tenant_isolation ON users');
    expect(sql).toContain("tenant_id = current_setting('app.current_tenant', true)::uuid");
    expect(sql).toContain("OR pg_has_role(current_user, 'app_admin', 'member')");
  });

  it('should honor custom tenant column, config key, and admin roles', () => {
    const sql = createRlsPolicy({
      tableName: 'orders',
      tenantColumn: 'workspace_id',
      configKey: 'app.current_workspace',
      adminRoles: ['ops_admin', 'support_admin'],
    });

    expect(sql).toContain("workspace_id = current_setting('app.current_workspace', true)::uuid");
    expect(sql).toContain("OR pg_has_role(current_user, 'ops_admin', 'support_admin', 'member')");
  });

  it('should omit admin bypass when no admin roles are provided', () => {
    const sql = createRlsPolicy({
      tableName: 'projects',
      adminRoles: [],
    });

    expect(sql).not.toContain('pg_has_role');
  });
});
