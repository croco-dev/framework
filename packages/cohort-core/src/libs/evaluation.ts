import { createHash } from "node:crypto";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type {
  CohortDefinition,
  CohortExplanation,
  CohortLimits,
  CohortMember,
  CohortOperator,
  CohortPredicate,
  CohortRegistration,
  CohortResult,
  CohortScalar,
  CohortScope,
  CohortSubject,
  CohortValidationContext,
} from "./contracts";

export class CohortInvalidProblem extends Problem {
  constructor(detail: string) {
    super("cohort/invalid", ProblemCategory.ValidationError, detail);
  }
}
export class CohortUnavailableProblem extends Problem {
  constructor(detail: string) {
    super("cohort/unavailable", ProblemCategory.ValidationError, detail);
  }
}
export const DEFAULT_COHORT_LIMITS: CohortLimits = Object.freeze({
  nesting: 4,
  predicates: 30,
  sample: 50,
  rows: 10000,
  cost: 300000,
});
export function sameCohortScope(a: CohortScope, b: CohortScope): boolean {
  return (
    Boolean(a.appId && a.environment && a.tenantId) &&
    a.appId === b.appId &&
    a.environment === b.environment &&
    a.tenantId === b.tenantId
  );
}
export function cohortTimestamp(value: string): number {
  const result = Date.parse(value);
  if (!Number.isFinite(result) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value))
    throw new CohortInvalidProblem("An explicit timestamp with timezone is required");
  return result;
}
export function validateCohort(
  definition: CohortDefinition,
  registration: CohortRegistration,
  context: CohortValidationContext,
): CohortLimits {
  const limits = { ...DEFAULT_COHORT_LIMITS, ...context.limits };
  if (Object.values(limits).some((value) => !Number.isSafeInteger(value) || value < 1))
    throw new CohortInvalidProblem("Limits must be positive integers");
  if (
    !sameCohortScope(definition.scope, context.scope) ||
    !definition.subjectKind ||
    definition.subjectKind !== context.subjectKind
  )
    throw new CohortInvalidProblem("Scope or subject kind mismatch");
  if (!definition.id || !Number.isSafeInteger(definition.version) || definition.version < 1)
    throw new CohortInvalidProblem("Invalid definition identity");
  let predicates = 0;
  function visit(node: CohortPredicate, depth: number): void {
    if (!node || depth > limits.nesting || ++predicates > limits.predicates)
      throw new CohortInvalidProblem("Predicate complexity exceeded");
    switch (node.kind) {
      case "all":
      case "any":
        if (!Array.isArray(node.children) || node.children.length === 0)
          throw new CohortInvalidProblem("Groups require children");
        node.children.forEach((child) => visit(child, depth + 1));
        return;
      case "not":
        visit(node.child, depth + 1);
        return;
      case "fact": {
        const field = Object.hasOwn(registration.fields, node.field)
          ? registration.fields[node.field]
          : undefined;
        if (!field || !context.allowedFields.includes(node.field))
          throw new CohortInvalidProblem("Field is not authorized");
        if (
          !field.operators.includes(node.operator) ||
          !["eq", "ne", "gt", "gte", "lt", "lte"].includes(node.operator) ||
          (field.type !== "number" && node.operator !== "eq" && node.operator !== "ne")
        )
          throw new CohortInvalidProblem("Operator is not registered");
        if (
          typeof node.value !== field.type ||
          (typeof node.value === "number" && !Number.isFinite(node.value)) ||
          (field.values && !field.values.includes(node.value))
        )
          throw new CohortInvalidProblem("Invalid fact input");
        return;
      }
      case "event":
        if (
          !registration.events.includes(node.event) ||
          !["count", "distinct-calendar-days"].includes(node.metric) ||
          !["eq", "ne", "gt", "gte", "lt", "lte"].includes(node.operator) ||
          !Number.isSafeInteger(node.value) ||
          node.value < 0 ||
          !Number.isSafeInteger(node.windowDays) ||
          node.windowDays < 1 ||
          node.windowDays > 36600
        )
          throw new CohortInvalidProblem("Invalid event predicate");
        return;
      case "static":
        if (!registration.memberships.includes(node.membershipId))
          throw new CohortInvalidProblem("Unregistered membership");
        return;
      default:
        throw new CohortInvalidProblem("Unsupported predicate");
    }
  }
  visit(definition.root, 1);
  return limits;
}
function compare(left: CohortScalar, operator: CohortOperator, right: CohortScalar): boolean {
  switch (operator) {
    case "eq":
      return left === right;
    case "ne":
      return left !== right;
    case "gt":
      return left > right;
    case "gte":
      return left >= right;
    case "lt":
      return left < right;
    case "lte":
      return left <= right;
    default:
      throw new CohortInvalidProblem("Unsupported operator");
  }
}
export function evaluateCohort(
  definition: CohortDefinition,
  subject: CohortSubject,
  asOf: string,
): CohortMember {
  const end = cohortTimestamp(asOf);
  if (!subject.subjectId) throw new CohortInvalidProblem("Subject id is required");
  function visit(node: CohortPredicate): CohortExplanation {
    let result: CohortResult;
    switch (node.kind) {
      case "all":
      case "any": {
        const children = node.children.map(visit);
        const decisive = node.kind === "all" ? "no_match" : "match";
        result = children.some((child) => child.result === decisive)
          ? decisive
          : children.some((child) => child.result === "unknown")
            ? "unknown"
            : node.kind === "all"
              ? "match"
              : "no_match";
        return { kind: node.kind, result, reason: "group", children };
      }
      case "not": {
        const child = visit(node.child);
        result =
          child.result === "unknown" ? "unknown" : child.result === "match" ? "no_match" : "match";
        return { kind: node.kind, result, reason: "negation", children: [child] };
      }
      case "fact": {
        const value = Object.hasOwn(subject.facts, node.field)
          ? subject.facts[node.field]
          : undefined;
        if (value === undefined || value === null)
          return { kind: node.kind, result: "unknown", reason: "fact_unavailable" };
        if (
          typeof value !== typeof node.value ||
          (typeof value === "number" && !Number.isFinite(value))
        )
          throw new CohortInvalidProblem("Source fact type mismatch");
        result = compare(value, node.operator, node.value) ? "match" : "no_match";
        break;
      }
      case "event": {
        const start = end - node.windowDays * 86400000;
        const intervals = subject.coverage
          .filter((item) => item.event === node.event)
          .map((item) => ({ from: cohortTimestamp(item.from), to: cohortTimestamp(item.to) }))
          .sort((a, b) => a.from - b.from);
        let coveredUntil = start;
        for (const interval of intervals) {
          if (interval.to < interval.from)
            throw new CohortInvalidProblem("Invalid coverage interval");
          if (interval.from <= coveredUntil) coveredUntil = Math.max(coveredUntil, interval.to);
        }
        if (coveredUntil < end)
          return { kind: node.kind, result: "unknown", reason: "coverage_unavailable" };
        const events = subject.events
          .filter((event) => event.event === node.event)
          .map((event) => cohortTimestamp(event.occurredAt))
          .filter((time) => time >= start && time < end);
        const value =
          node.metric === "count"
            ? events.length
            : new Set(events.map((time) => new Date(time).toISOString().slice(0, 10))).size;
        result = compare(value, node.operator, node.value) ? "match" : "no_match";
        break;
      }
      case "static":
        result = subject.memberships.includes(node.membershipId) ? "match" : "no_match";
        break;
      default:
        throw new CohortInvalidProblem("Unsupported predicate");
    }
    return { kind: node.kind, result, reason: "predicate" };
  }
  const explanation = visit(definition.root);
  return { subjectId: subject.subjectId, result: explanation.result, explanation };
}
export function previewCohort(
  definition: CohortDefinition,
  registration: CohortRegistration,
  context: CohortValidationContext,
  subjects: readonly CohortSubject[],
  asOf: string,
  sampleSize = 50,
): Readonly<{
  total: number;
  match: number;
  noMatch: number;
  unknown: number;
  sample: readonly CohortMember[];
}> {
  const limits = validateCohort(definition, registration, context);
  if (
    !Number.isSafeInteger(sampleSize) ||
    sampleSize < 0 ||
    sampleSize > limits.sample ||
    subjects.length > limits.rows ||
    subjects.length * countPredicates(definition.root) > limits.cost
  )
    throw new CohortInvalidProblem("Query budget exceeded");
  const seen = new Set<string>();
  const members = subjects
    .map((subject) => {
      if (seen.has(subject.subjectId)) throw new CohortInvalidProblem("Duplicate subject");
      seen.add(subject.subjectId);
      return evaluateCohort(definition, subject, asOf);
    })
    .sort((a, b) => (a.subjectId < b.subjectId ? -1 : a.subjectId > b.subjectId ? 1 : 0));
  return {
    total: members.length,
    match: members.filter((member) => member.result === "match").length,
    noMatch: members.filter((member) => member.result === "no_match").length,
    unknown: members.filter((member) => member.result === "unknown").length,
    sample: members.slice(0, sampleSize),
  };
}
function countPredicates(node: CohortPredicate): number {
  return (
    1 +
    (node.kind === "all" || node.kind === "any"
      ? node.children.reduce((sum, child) => sum + countPredicates(child), 0)
      : node.kind === "not"
        ? countPredicates(node.child)
        : 0)
  );
}
export function cohortContentHash(subjectIds: readonly string[]): string {
  return createHash("sha256")
    .update(JSON.stringify([...subjectIds].sort()))
    .digest("hex");
}
