export interface RlsPolicyOptions {
  /**
   * Database table name
   */
  tableName: string;
  /**
   * Column name for tenant ID
   * @default 'tenant_id'
   */
  tenantColumn?: string;
  /**
   * Config key for RLS
   * @default 'app.current_tenant'
   */
  configKey?: string;
  /**
   * Admin roles that can bypass RLS
   * @default ['app_admin']
   */
  adminRoles?: string[];
}

/**
 * Generates a PostgreSQL Row Level Security (RLS) policy SQL string.
 * This can be used in migration files.
 *
 * @example
 * ```ts
 * sql.raw(createRlsPolicy({ tableName: 'users' }))
 * ```
 */
export function createRlsPolicy(options: RlsPolicyOptions): string {
  const {
    tableName,
    tenantColumn = 'tenant_id',
    configKey = 'app.current_tenant',
    adminRoles = ['app_admin'],
  } = options;

  const adminCheck =
    adminRoles.length > 0 ? `OR pg_has_role(current_user, '${adminRoles.join("', '")}', 'member')` : '';

  return `
    ALTER TABLE ${tableName} ENABLE ROW LEVEL SECURITY;

    CREATE POLICY ${tableName}_tenant_isolation ON ${tableName}
      AS RESTRICTIVE
      FOR ALL
      USING (
        ${tenantColumn} = current_setting('${configKey}', true)::uuid
        ${adminCheck}
      );
  `.trim();
}
