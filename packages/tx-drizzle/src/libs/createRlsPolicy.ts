import { sql } from "drizzle-orm";
import { PgDialect } from "drizzle-orm/pg-core";
import { qualifiedIdentifier, validateRlsPolicyOptions } from "./RlsSql";

const POLICY_OWNER = "croco:tx-drizzle:createRlsPolicy:v1";
const LEGACY_PROBE_NAME = "croco_rls_legacy_probe";

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
  const legacyTenantPredicate = sql`${sql.identifier(validated.tenantColumn)} = current_setting(${validated.configKey}, true)${tenantCast}${adminCheck}`;
  const legacyDefaultPredicate = sql`${sql.identifier(validated.tenantColumn)} = current_setting(${validated.configKey}, true)${tenantCast} OR pg_has_role(current_user, 'app_admin', 'member')`;
  const legacyMatch = sql`EXISTS (
    SELECT 1
    FROM pg_policy existing
    JOIN pg_policy probe ON probe.polrelid = existing.polrelid
    WHERE existing.polrelid = ${tableReference}::regclass
      AND existing.polname = ${validated.policyName}
      AND probe.polname = ${LEGACY_PROBE_NAME}
      AND NOT existing.polpermissive
      AND existing.polcmd = '*'
      AND existing.polroles = probe.polroles
      AND existing.polwithcheck IS NULL
      AND obj_description(existing.oid, 'pg_policy') IS NULL
      AND pg_get_expr(existing.polqual, existing.polrelid) = pg_get_expr(probe.polqual, probe.polrelid)
  )`;
  const legacyDefaultProbe =
    validated.adminRoles.length === 0
      ? sql`
  IF NOT legacy_matches THEN
    CREATE POLICY ${sql.identifier(LEGACY_PROBE_NAME)} ON ${tableIdentifier}
    AS RESTRICTIVE FOR ALL USING (${legacyDefaultPredicate});
    legacy_matches := ${legacyMatch};
    DROP POLICY ${sql.identifier(LEGACY_PROBE_NAME)} ON ${tableIdentifier};
  END IF;`
      : sql.empty();
  const policy = sql`DECLARE legacy_matches boolean;
BEGIN
  ALTER TABLE ${tableIdentifier} ENABLE ROW LEVEL SECURITY;
  IF EXISTS (
    SELECT 1 FROM pg_policy
    WHERE polrelid = ${tableReference}::regclass
      AND polname = ${validated.policyName}
      AND obj_description(oid, 'pg_policy') IS DISTINCT FROM ${POLICY_OWNER}
  ) THEN
    IF EXISTS (
      SELECT 1 FROM pg_policy
      WHERE polrelid = ${tableReference}::regclass
        AND polname IN (${validated.accessPolicyName}, ${LEGACY_PROBE_NAME})
    ) THEN
      RAISE EXCEPTION 'RLS restrictive policy name is already in use';
    END IF;
    CREATE POLICY ${sql.identifier(LEGACY_PROBE_NAME)} ON ${tableIdentifier}
    AS RESTRICTIVE FOR ALL USING (${legacyTenantPredicate});
    legacy_matches := ${legacyMatch};
    DROP POLICY ${sql.identifier(LEGACY_PROBE_NAME)} ON ${tableIdentifier};${legacyDefaultProbe}
    IF NOT legacy_matches THEN
      RAISE EXCEPTION 'RLS restrictive policy name is already in use';
    END IF;
  END IF;
  IF EXISTS (
    SELECT 1
    FROM pg_policy
    WHERE polrelid = ${tableReference}::regclass
      AND polname = ${validated.accessPolicyName}
      AND obj_description(oid, 'pg_policy') IS DISTINCT FROM ${POLICY_OWNER}
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
  COMMENT ON POLICY ${sql.identifier(validated.policyName)} ON ${tableIdentifier} IS ${POLICY_OWNER};

  CREATE POLICY ${sql.identifier(validated.accessPolicyName)} ON ${tableIdentifier}
  AS PERMISSIVE
  FOR ALL
  USING (${tenantPredicate})
  WITH CHECK (${tenantPredicate});
  COMMENT ON POLICY ${sql.identifier(validated.accessPolicyName)} ON ${tableIdentifier} IS ${POLICY_OWNER};
END`;

  const body = dialect.sqlToQuery(policy.inlineParams()).sql;
  let delimiter = "$croco_rls$";
  for (let suffix = 0; body.includes(delimiter); suffix++) {
    delimiter = `$croco_rls_${suffix}$`;
  }
  return `DO ${delimiter}\n${body}\n${delimiter};`;
}
