export interface RlsPolicyOptions {
  tableName: string;
  tenantColumn?: string;
  configKey?: string;
  adminRoles?: string[];
}
export function createRlsPolicy(options: RlsPolicyOptions): string {
  const {
    tableName,
    tenantColumn = "tenant_id",
    configKey = "app.current_tenant",
    adminRoles = ["app_admin"],
  } = options;

  const adminCheck =
    adminRoles.length > 0
      ? `OR pg_has_role(current_user, '${adminRoles.join("', '")}', 'member')`
      : "";

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
