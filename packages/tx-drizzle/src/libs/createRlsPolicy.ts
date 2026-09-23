import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { qualifiedIdentifier, validateRlsPolicyOptions } from "./RlsSql";

const ACCESS_POLICY_OWNER = "croco:tx-drizzle:createRlsPolicy:v1";

export interface RlsPolicyOptions {
  tableName: string;
  tenantColumn?: string;
  tenantColumnType?: "uuid" | "text";
  configKey?: string;
  adminRoles?: string[];
}
export function createRlsPolicy(options: RlsPolicyOptions): string {
  const {
    tableName,
    tenantColumn = "tenant_id",
    tenantColumnType = "uuid",
    configKey = "app.current_tenant",
    adminRoles = [],
  } = options;

  const validated = validateRlsPolicyOptions({
    adminRoles,
    configKey,
    tableName,
    tenantColumn,
    tenantColumnType,
  });
  const tableIdentifier = qualifiedIdentifier(validated.tableName);
  const dialect = new PgDialect();
  const tableReference = dialect.sqlToQuery(tableIdentifier).sql;
  const adminPredicates = validated.adminRoles.map(
    (role) => sql`pg_has_role(current_user, ${role}, 'member')`,
  );
  const adminCheck =
    adminPredicates.length > 0
      ? sql`${sql.raw("\n        OR ")}${sql.join(adminPredicates, sql.raw("\n        OR "))}`
      : sql.empty();
  const tenantCast = tenantColumnType === "uuid" ? sql`::uuid` : sql.empty();
  const tenantPredicate = sql`${sql.identifier(validated.tenantColumn)} = NULLIF(current_setting(${validated.configKey}, true), '')${tenantCast}${adminCheck}`;
  const policy = sql`BEGIN
  ALTER TABLE ${tableIdentifier} ENABLE ROW LEVEL SECURITY;
  IF EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = ${tableReference}::regclass
      AND polname = ${validated.accessPolicyName}
      AND obj_description(oid, 'pg_policy') IS DISTINCT FROM ${ACCESS_POLICY_OWNER}
  ) THEN
    RAISE EXCEPTION 'RLS companion policy name is already in use';
  END IF;
  DROP POLICY IF EXISTS ${sql.identifier(validated.policyName)} ON ${tableIdentifier};
  DROP POLICY IF EXISTS ${sql.identifier(validated.accessPolicyName)} ON ${tableIdentifier};

  CREATE POLICY ${sql.identifier(validated.policyName)} ON ${tableIdentifier}
  AS RESTRICTIVE
  FOR ALL
  USING (${tenantPredicate})
  WITH CHECK (${tenantPredicate});

  CREATE POLICY ${sql.identifier(validated.accessPolicyName)} ON ${tableIdentifier}
  AS PERMISSIVE
  FOR ALL
  USING (${tenantPredicate})
  WITH CHECK (${tenantPredicate});
  COMMENT ON POLICY ${sql.identifier(validated.accessPolicyName)} ON ${tableIdentifier} IS ${ACCESS_POLICY_OWNER};
END`;

  const body = dialect.sqlToQuery(policy.inlineParams()).sql;
  let delimiter = "$croco_rls$";
  for (let suffix = 0; body.includes(delimiter); suffix++) {
    delimiter = `$croco_rls_${suffix}$`;
  }
  return `DO ${delimiter}\n${body}\n${delimiter};`;
}
