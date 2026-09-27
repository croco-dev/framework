import type { CohortPredicate, CohortScope } from "../index";

// @ts-expect-error Arbitrary SQL and JavaScript are not predicate kinds.
const arbitrary: CohortPredicate = { kind: "sql", expression: "select 1" };
const count: CohortPredicate = {
  kind: "event",
  event: "report.created",
  metric: "count",
  operator: "eq",
  // @ts-expect-error Event counts require numeric input.
  value: "zero",
  windowDays: 7,
};
const operator: CohortPredicate = {
  kind: "fact",
  field: "plan",
  // @ts-expect-error The operator vocabulary is closed.
  operator: "contains",
  value: "trial",
};
// @ts-expect-error Tenant omission is not a global query.
const scope: CohortScope = { appId: "app", environment: "test" };
void [arbitrary, count, operator, scope];
