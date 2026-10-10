import {
  compareAssignedOutcomes,
  hashAssignedOutcomeInput,
  hashAssignedOutcomeDefinition,
} from "@croco/metrics-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import { parseAssignedOutcomeReport } from "@croco/metrics-core/runtime";
import type {
  AssignedOutcomeInput,
  AssignedOutcomeReport,
  OutcomeCutoff,
  OutcomeScope,
} from "@croco/metrics-core";

export type NetOutcomeRequest = { cutoff: OutcomeCutoff; revision: string };
export type NetOutcomeSnapshot = Omit<
  AssignedOutcomeReport,
  "assignmentSnapshot" | "diagnostics"
> & {
  assignmentSnapshot: { id: string; unit: string; arms: readonly string[] };
  diagnostics: readonly { code: string; arm?: string; currency?: string; source?: string }[];
  sources: readonly string[];
};
export type NetOutcomeState =
  | { kind: "loading" | "empty" }
  | { kind: "denied" | "error"; code: string }
  | { kind: "ready" | "partial"; snapshot: NetOutcomeSnapshot };
export type NetOutcomeDrilldownRequest = NetOutcomeRequest & {
  arm: string;
  currency: string;
  source: string;
  limit: number;
};
export type NetOutcomeDrilldown = {
  rows: readonly { kind: string; occurredAt: string; maskedReference: string }[];
  truncated: boolean;
  assumptions: readonly string[];
};
export type NetOutcomeGrant = { permissionEpoch: string; privacyEpoch: string };
export type NetOutcomeAuthority = {
  currentScope(): OutcomeScope;
  authorize(
    action: "read" | "export" | "drilldown",
    scope: OutcomeScope,
  ): Promise<NetOutcomeGrant | null>;
};
/** Server-only adapter. Scope and masking must be enforced by the host on every read. */
export type NetOutcomeSource = {
  read(
    request: NetOutcomeRequest,
    scope: OutcomeScope,
  ): Promise<AssignedOutcomeInput | AssignedOutcomeReport | null>;
  drilldown(request: NetOutcomeDrilldownRequest, scope: OutcomeScope): Promise<NetOutcomeDrilldown>;
};
export class NetOutcomeProblem extends Problem {
  constructor(code: string) {
    super(
      `admin/net-outcome/${code}`,
      ProblemCategory.BadRequest,
      `Net outcome operation failed: ${code}`,
    );
  }
}
const sameScope = (a: OutcomeScope, b: OutcomeScope) =>
  a.app === b.app && a.environment === b.environment && a.tenant === b.tenant;
function validate(request: NetOutcomeRequest): void {
  if (
    !request.revision?.trim() ||
    request.revision.length > 1024 ||
    !request.cutoff ||
    ![request.cutoff.effectiveAt, request.cutoff.knownAt].every(
      (value) =>
        typeof value === "string" && value.length <= 24 && Number.isFinite(Date.parse(value)),
    )
  )
    throw new NetOutcomeProblem("invalid-request");
}
export function createNetOutcomeOperations(
  source: NetOutcomeSource,
  authority: NetOutcomeAuthority,
) {
  async function guard<T>(
    action: "read" | "export" | "drilldown",
    operation: (scope: OutcomeScope) => Promise<T>,
  ): Promise<T> {
    const scope = { ...authority.currentScope() };
    if (
      ![scope.app, scope.environment, scope.tenant].every(
        (value) => typeof value === "string" && value.trim().length > 0,
      )
    )
      throw new NetOutcomeProblem("denied");
    const authorized = await authority.authorize(action, { ...scope });
    const grant = authorized ? { ...authorized } : null;
    if (
      !grant ||
      !grant.permissionEpoch ||
      !grant.privacyEpoch ||
      !sameScope(scope, authority.currentScope())
    )
      throw new NetOutcomeProblem("denied");
    const result = await operation(scope);
    const current = await authority.authorize(action, { ...scope });
    if (
      !current ||
      !sameScope(scope, authority.currentScope()) ||
      current.permissionEpoch !== grant.permissionEpoch ||
      current.privacyEpoch !== grant.privacyEpoch
    )
      throw new NetOutcomeProblem("denied");
    return result;
  }
  async function read(
    request: NetOutcomeRequest,
    action: "read" | "export",
  ): Promise<NetOutcomeState> {
    request = structuredClone(request);
    validate(request);
    try {
      return await guard(action, async (scope): Promise<NetOutcomeState> => {
        const received = await source.read(structuredClone(request), { ...scope });
        if (!received) return { kind: "empty" };
        const input = structuredClone(received);
        const definitionHash = await hashAssignedOutcomeDefinition();
        let report: AssignedOutcomeReport;
        if ("events" in input) {
          if ((await hashAssignedOutcomeInput(input)) !== input.inputHash)
            throw new NetOutcomeProblem("input-hash-mismatch");
          if (definitionHash !== input.definitionHash)
            throw new NetOutcomeProblem("definition-hash-mismatch");
          report = compareAssignedOutcomes(input);
        } else {
          report = parseAssignedOutcomeReport(input, definitionHash);
        }
        if (
          report.sources.length === 0 ||
          report.sources.length > 100 ||
          new Set(report.sources).size !== report.sources.length ||
          report.costCompleteness.some((cost) => !report.sources.includes(cost.source)) ||
          !sameScope(input.assignmentSnapshot.scope, scope) ||
          input.revision !== request.revision ||
          input.cutoff.effectiveAt !== request.cutoff.effectiveAt ||
          input.cutoff.knownAt !== request.cutoff.knownAt
        )
          throw new NetOutcomeProblem("source-mismatch");
        const snapshot: NetOutcomeSnapshot = {
          ...report,
          cutoff: { effectiveAt: report.cutoff.effectiveAt, knownAt: report.cutoff.knownAt },
          costCompleteness: report.costCompleteness.map(
            ({ arm, source: sourceName, kind, currency, status, pendingCount }) => ({
              arm,
              source: sourceName,
              kind,
              currency,
              status,
              ...(pendingCount === undefined ? {} : { pendingCount }),
            }),
          ),
          assignmentSnapshot: {
            id: report.assignmentSnapshot.id,
            unit: report.assignmentSnapshot.unit,
            arms: [...report.assignmentSnapshot.arms],
          },
          sources: [...input.sources],
          diagnostics: report.diagnostics.map(({ code, arm, currency, source: sourceName }) => ({
            code,
            arm,
            currency,
            source: sourceName,
          })),
        };
        return { kind: report.quality === "partial" ? "partial" : "ready", snapshot };
      });
    } catch (error) {
      if (error instanceof NetOutcomeProblem && error.code === "admin/net-outcome/denied")
        return { kind: "denied", code: error.code };
      throw error;
    }
  }
  return {
    read: (request: NetOutcomeRequest) => read(request, "read"),
    export: (request: NetOutcomeRequest) => read(request, "export"),
    async drilldown(request: NetOutcomeDrilldownRequest): Promise<NetOutcomeDrilldown> {
      request = structuredClone(request);
      validate(request);
      if (
        !Number.isSafeInteger(request.limit) ||
        request.limit < 1 ||
        request.limit > 100 ||
        !request.arm ||
        !request.source ||
        !/^[A-Z]{3}$/.test(request.currency)
      )
        throw new NetOutcomeProblem("invalid-drilldown");
      return guard("drilldown", async (scope) => {
        const page = await source.drilldown(structuredClone(request), { ...scope });
        if (
          page.rows.length > request.limit ||
          page.assumptions.length > 16 ||
          page.assumptions.some((value) => value.length > 256) ||
          page.rows.some(
            (row) =>
              row.kind.length > 64 ||
              row.maskedReference.length > 128 ||
              row.occurredAt.length > 40,
          )
        )
          throw new NetOutcomeProblem("page-bound-exceeded");
        return {
          rows: page.rows.map(({ kind, occurredAt, maskedReference }) => ({
            kind,
            occurredAt,
            maskedReference,
          })),
          truncated: page.truncated,
          assumptions: [...page.assumptions],
        };
      });
    },
  };
}
