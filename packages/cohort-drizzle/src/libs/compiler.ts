import { sql } from "drizzle-orm";
import { CohortInvalidProblem, cohortTimestamp, validateCohort } from "@croco/cohort-core";
import type { SQL } from "drizzle-orm";
import type {
  CohortDefinition,
  CohortPredicate,
  CohortRegistration,
  CohortValidationContext,
} from "@croco/cohort-core";

/** Each source row is one subject in a retained, immutable source snapshot. */
export type CohortSourceMapping = Readonly<{
  table: string;
  subjectId: string;
  snapshotId: string;
  appId: string;
  environment: string;
  tenantId: string;
  subjectKind: string;
  facts: Readonly<Record<string, string>>;
  events: string;
  coverage: string;
  memberships: string;
}>;
export function identifier(name: string): SQL {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name))
    throw new CohortInvalidProblem("Invalid registered SQL identifier");
  return sql`${sql.identifier(name)}`;
}
const operators = { eq: "=", ne: "<>", gt: ">", gte: ">=", lt: "<", lte: "<=" } as const;
export function compileCohortPredicate(
  definition: CohortDefinition,
  registration: CohortRegistration,
  context: CohortValidationContext,
  mapping: CohortSourceMapping,
  asOf: string,
): SQL {
  validateCohort(definition, registration, context);
  const end = new Date(cohortTimestamp(asOf));
  function compile(node: CohortPredicate): SQL {
    switch (node.kind) {
      case "all":
      case "any":
        return sql`(${sql.join(node.children.map(compile), sql.raw(node.kind === "all" ? " AND " : " OR "))})`;
      case "not":
        return sql`NOT (${compile(node.child)})`;
      case "fact": {
        const column = Object.hasOwn(mapping.facts, node.field)
          ? mapping.facts[node.field]
          : undefined;
        if (!column) throw new CohortInvalidProblem("Missing approved field mapping");
        return sql`${identifier(column)} ${sql.raw(operators[node.operator])} ${node.value}`;
      }
      case "static":
        return sql`${identifier(mapping.memberships)} @> ${JSON.stringify([node.membershipId])}::jsonb`;
      case "event": {
        const start = new Date(end.getTime() - node.windowDays * 86400000).toISOString();
        const coverage = sql`(SELECT range_agg(tstzrange((c->>'from')::timestamptz, (c->>'to')::timestamptz, '[)')) FROM jsonb_array_elements(${identifier(mapping.coverage)}) c WHERE c->>'event' = ${node.event}) @> tstzrange(${start}::timestamptz, ${asOf}::timestamptz, '[)')`;
        const count =
          node.metric === "count"
            ? sql`count(*)`
            : sql`count(DISTINCT ((e->>'occurredAt')::timestamptz AT TIME ZONE 'UTC')::date)`;
        return sql`CASE WHEN ${coverage} THEN (SELECT ${count} FROM jsonb_array_elements(${identifier(mapping.events)}) e WHERE e->>'event' = ${node.event} AND (e->>'occurredAt')::timestamptz >= ${start}::timestamptz AND (e->>'occurredAt')::timestamptz < ${asOf}::timestamptz) ${sql.raw(operators[node.operator])} ${node.value} ELSE NULL END`;
      }
    }
  }
  return compile(definition.root);
}
export function sourceScope(
  definition: CohortDefinition,
  mapping: CohortSourceMapping,
  snapshotId: string,
): SQL {
  return sql`${identifier(mapping.appId)} = ${definition.scope.appId} AND ${identifier(mapping.environment)} = ${definition.scope.environment} AND ${identifier(mapping.tenantId)} = ${definition.scope.tenantId} AND ${identifier(mapping.subjectKind)} = ${definition.subjectKind} AND ${identifier(mapping.snapshotId)} = ${snapshotId}`;
}
