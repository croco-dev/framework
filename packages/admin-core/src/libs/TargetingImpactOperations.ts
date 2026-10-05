import { decodeCampaignSnapshotData } from "@croco/engagement-core";
import {
  createPolicyReplayReport,
  importPolicyReplayReport,
  serializePolicyReplayReport,
  validatePolicyReplayInput,
} from "@croco/metrics-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { CampaignStore } from "@croco/engagement-core";
import type {
  PolicyReplayInput,
  PolicyReplayReport,
  ReplayRow,
  ReplayScope,
} from "@croco/metrics-core";

export type TargetingImpactAction = "read" | "replay" | "save" | "export";
export type TargetingImpactReport = Omit<PolicyReplayReport, "input"> & {
  readonly input: Omit<PolicyReplayInput, "rows" | "definition"> & {
    readonly definition: Omit<
      PolicyReplayInput["definition"],
      "existingPredicate" | "newPredicate"
    >;
  };
};
export interface TargetingImpactReportStore {
  /** Insert only. An existing key must contain exactly the same serialized report. */
  put(scope: ReplayScope, id: string, serialized: string): Promise<void>;
  get(scope: ReplayScope, id: string): Promise<string | undefined>;
}
export class TargetingImpactProblem extends Problem {
  constructor(
    code: string,
    detail: string,
    category = ProblemCategory.ValidationError,
    cause?: Error,
  ) {
    super(`admin-core/targeting-impact-${code}`, category, detail, cause ? { cause } : undefined);
  }
}
function scopeKey(scope: ReplayScope): string {
  if (
    !scope ||
    ["appId", "environment", "tenantId", "subjectKind"].some((key) => {
      const value = scope[key as keyof ReplayScope];
      return typeof value !== "string" || !value.trim();
    })
  )
    throw new TargetingImpactProblem(
      "scope",
      "Explicit app, environment, tenant and subject kind are required",
    );
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId, scope.subjectKind]);
}
function reportKey(scope: ReplayScope, id: string): string {
  if (typeof id !== "string" || !id.trim())
    throw new TargetingImpactProblem("id", "Report id is required");
  return JSON.stringify([scopeKey(scope), id]);
}
export class InMemoryTargetingImpactReportStore implements TargetingImpactReportStore {
  private readonly reports = new Map<string, string>();
  async put(scope: ReplayScope, id: string, serialized: string): Promise<void> {
    const key = reportKey(scope, id);
    const existing = this.reports.get(key);
    if (existing !== undefined && existing !== serialized)
      throw new TargetingImpactProblem(
        "immutable",
        "Saved reports are immutable",
        ProblemCategory.Conflict,
      );
    this.reports.set(key, serialized);
  }
  async get(scope: ReplayScope, id: string): Promise<string | undefined> {
    return this.reports.get(reportKey(scope, id));
  }
}
export type CampaignReplayRequest = Readonly<{
  scope: ReplayScope;
  snapshotId: string;
  configuration: Omit<PolicyReplayInput, "scope" | "snapshotRef" | "rows">;
  bounds: Readonly<{ pageSize: number; maxPages: number; maxMembers: number }>;
}>;
export type CampaignReplayResult = Readonly<{
  status: "available" | "partial" | "unavailable";
  sourceCoverage: Readonly<{ memberN: number; replayedMemberN: number; missingHistoryN: number }>;
  report?: TargetingImpactReport;
}>;
export type TargetingImpactOperationsOptions = Readonly<{
  /** Construct on the server; derive authority from the authenticated session, never request permissions. */
  authorize: (scope: ReplayScope, action: TargetingImpactAction) => Promise<boolean>;
  reports: TargetingImpactReportStore;
  campaignStore?: CampaignStore;
  campaignScope?: ReplayScope;
}>;
function aggregate(report: PolicyReplayReport): TargetingImpactReport {
  const { rows: _rows, definition, ...input } = report.input;
  const { existingPredicate: _existing, newPredicate: _new, ...summary } = definition;
  return Object.freeze({
    version: report.version,
    definitionHash: report.definitionHash,
    inputHash: report.inputHash,
    input: Object.freeze({ ...input, definition: Object.freeze(summary) }),
    result: report.result,
  });
}
function parseInput(value: unknown): PolicyReplayInput {
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      throw new TargetingImpactProblem("json", "Invalid replay JSON");
    }
  }
  return validatePolicyReplayInput(value);
}
/** Server-only boundary: full evidence remains in private persistence; callers receive aggregates. */
export class TargetingImpactOperations {
  constructor(private readonly options: TargetingImpactOperationsOptions) {}
  private async authorize(scope: ReplayScope, action: TargetingImpactAction): Promise<void> {
    scopeKey(scope);
    if (!(await this.options.authorize(scope, action)))
      throw new TargetingImpactProblem(
        "denied",
        "Targeting impact scope or permission denied",
        ProblemCategory.Forbidden,
      );
  }
  private async provider<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (error instanceof Problem) throw error;
      throw new TargetingImpactProblem(
        "provider-failed",
        "Targeting impact evidence provider failed",
        ProblemCategory.InternalServerError,
        error instanceof Error ? error : undefined,
      );
    }
  }
  async replay(value: unknown): Promise<TargetingImpactReport> {
    const input = parseInput(value);
    await this.authorize(input.scope, "replay");
    return aggregate(await createPolicyReplayReport(input));
  }
  async save(value: unknown): Promise<TargetingImpactReport> {
    const input = parseInput(value);
    await this.authorize(input.scope, "save");
    const report = await createPolicyReplayReport(input);
    const serialized = serializePolicyReplayReport(report);
    await this.provider(() => this.options.reports.put(input.scope, report.inputHash, serialized));
    const loaded = await this.read(input.scope, report.inputHash);
    if (serializePolicyReplayReport(loaded) !== serialized)
      throw new TargetingImpactProblem(
        "integrity",
        "Saved report differs from its reloaded evidence",
      );
    return aggregate(loaded);
  }
  private async read(scope: ReplayScope, id: string): Promise<PolicyReplayReport> {
    reportKey(scope, id);
    const serialized = await this.provider(() => this.options.reports.get(scope, id));
    if (serialized === undefined)
      throw new TargetingImpactProblem(
        "not-found",
        "Saved replay report was not found",
        ProblemCategory.NotFound,
      );
    const report = await importPolicyReplayReport(serialized);
    if (scopeKey(report.input.scope) !== scopeKey(scope) || report.inputHash !== id)
      throw new TargetingImpactProblem(
        "integrity",
        "Saved report identity or scope differs from the request",
      );
    return report;
  }
  async load(scope: ReplayScope, id: string): Promise<TargetingImpactReport> {
    await this.authorize(scope, "read");
    return aggregate(await this.read(scope, id));
  }
  async export(scope: ReplayScope, id: string): Promise<string> {
    await this.authorize(scope, "export");
    return JSON.stringify(aggregate(await this.read(scope, id)));
  }
  async replayCampaign(request: CampaignReplayRequest): Promise<CampaignReplayResult> {
    const { scope, snapshotId, bounds } = request;
    await this.authorize(scope, "read");
    await this.authorize(scope, "replay");
    const store = this.options.campaignStore;
    if (!store)
      throw new TargetingImpactProblem("campaign-unavailable", "Campaign store is not configured");
    if (
      !this.options.campaignScope ||
      scopeKey(this.options.campaignScope) !== scopeKey(scope) ||
      scope.subjectKind !== "user"
    )
      throw new TargetingImpactProblem(
        "campaign-scope",
        "Campaign store must be registered for this app, environment, tenant and user subject kind",
      );
    if (
      !bounds ||
      ![bounds.pageSize, bounds.maxPages, bounds.maxMembers].every(
        (n) => Number.isSafeInteger(n) && n > 0,
      ) ||
      bounds.pageSize > 1000 ||
      bounds.maxPages > 100 ||
      bounds.maxMembers > 10000
    )
      throw new TargetingImpactProblem(
        "bounds",
        "Campaign limits require pageSize <= 1000, maxPages <= 100 and maxMembers <= 10000",
      );
    const base = validatePolicyReplayInput({
      ...request.configuration,
      scope,
      snapshotRef: snapshotId,
      rows: [],
    });
    const tenant = { kind: "tenant", tenantId: scope.tenantId } as const;
    const snapshot = await this.provider(() => store.getSnapshot(tenant, snapshotId));
    if (!snapshot || snapshot.state !== "complete")
      throw new TargetingImpactProblem(
        "snapshot-unavailable",
        "A complete campaign snapshot is required",
      );
    if (
      snapshot.id !== snapshotId ||
      snapshot.scope.kind !== "tenant" ||
      snapshot.scope.tenantId !== scope.tenantId ||
      !Number.isSafeInteger(snapshot.memberCount) ||
      snapshot.memberCount < 0
    )
      throw new TargetingImpactProblem(
        "snapshot-scope",
        "Campaign snapshot identity, tenant or count is invalid",
      );
    if (snapshot.memberCount > bounds.maxMembers)
      throw new TargetingImpactProblem("bounds", "Campaign snapshot exceeds the member limit");
    const rows: ReplayRow[] = [];
    const keys = new Set<string>();
    let ordinal = 0;
    let pageN = 0;
    while (ordinal < snapshot.memberCount) {
      if (++pageN > bounds.maxPages)
        throw new TargetingImpactProblem("bounds", "Campaign snapshot exceeds the page limit");
      const page = await this.provider(() =>
        store.listSnapshotMembers(tenant, snapshotId, {
          limit: bounds.pageSize,
          ...(ordinal ? { afterOrdinal: ordinal - 1 } : {}),
        }),
      );
      if (
        !page.members.length ||
        page.members.length > bounds.pageSize ||
        ordinal + page.members.length > snapshot.memberCount
      )
        throw new TargetingImpactProblem("page", "Campaign page size or completeness is invalid");
      for (const member of page.members) {
        if (
          member.ordinal !== ordinal ||
          member.snapshotId !== snapshotId ||
          member.scope.kind !== "tenant" ||
          member.scope.tenantId !== scope.tenantId ||
          !member.memberKey.trim() ||
          keys.has(member.memberKey) ||
          (member.recipient && member.recipient.tenantId !== scope.tenantId)
        )
          throw new TargetingImpactProblem(
            "page",
            "Campaign members must be contiguous, unique and tenant scoped",
          );
        ordinal += 1;
        keys.add(member.memberKey);
        if (member.state !== "ready") continue;
        const data = decodeCampaignSnapshotData(member.data);
        if (!data || typeof data !== "object" || !Object.hasOwn(data, "policyReplayRow")) continue;
        const row = (data as Record<string, unknown>).policyReplayRow;
        const validated = validatePolicyReplayInput({ ...base, rows: [row] }).rows[0];
        if (!validated || validated.subjectId !== member.recipient.userId)
          throw new TargetingImpactProblem(
            "subject",
            "Replay history must belong to the campaign recipient",
          );
        rows.push(validated);
      }
      if (
        (ordinal < snapshot.memberCount && page.nextOrdinal !== ordinal - 1) ||
        (ordinal === snapshot.memberCount && page.nextOrdinal !== undefined)
      )
        throw new TargetingImpactProblem("page", "Campaign page cursor is inconsistent");
    }
    const sourceCoverage = Object.freeze({
      memberN: snapshot.memberCount,
      replayedMemberN: rows.length,
      missingHistoryN: snapshot.memberCount - rows.length,
    });
    if (!rows.length) return Object.freeze({ status: "unavailable", sourceCoverage });
    const report = aggregate(await createPolicyReplayReport({ ...base, rows }));
    return Object.freeze({
      status: rows.length === snapshot.memberCount ? "available" : "partial",
      sourceCoverage,
      report,
    });
  }
}
