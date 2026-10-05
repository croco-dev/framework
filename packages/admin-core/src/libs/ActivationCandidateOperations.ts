import { calculateActivationCandidates, hashActivationInputs } from "@croco/metrics-core";
import { Problem, ProblemCategory } from "@croco/problems-core";
import type { ActivationDefinition, ActivationReport, ActivationRow } from "@croco/metrics-core";

export type ActivationAdminScope = Readonly<{
  app: string;
  environment: string;
  tenantId: string;
  subjectKind: "user" | "account";
}>;
export type ActivationAdminAccess = Readonly<{
  scope: ActivationAdminScope;
  permissions: readonly ("activation.read" | "activation.report-write")[];
}>;
export type ActivationSavedReport = Readonly<{
  id: string;
  scope: ActivationAdminScope;
  sourceRunRef: string;
  definitionHash: string;
  inputHash: string;
  selectedCandidateId: string;
  selectedCohort: "new" | "returning";
  report: ActivationReport;
  reportHash: string;
}>;
export type ActivationExplorerState =
  | { readonly kind: "loading" | "empty" }
  | { readonly kind: "denied" | "error"; readonly code: string }
  | { readonly kind: "ready" | "partial"; readonly report: ActivationReport };
export type ActivationCandidateOperationsOptions = {
  /** Resolve the authenticated server session, never request-supplied grants. */
  authenticate(): Promise<ActivationAdminAccess>;
  /** Resolve an immutable, scope-bound source run; undefined selects the current run. */
  loadInput(
    scope: ActivationAdminScope,
    sourceRunRef?: string,
    signal?: AbortSignal,
  ): Promise<{
    definition: ActivationDefinition;
    rows: readonly ActivationRow[];
  }>;
  /** Trusted host persistence: isolate all scope fields and authorize every write.
   * The report digest detects corruption; it is not a signature against a writer who can replace the payload and digest.
   */
  store: {
    read(
      scope: ActivationAdminScope,
      id: string,
      signal?: AbortSignal,
    ): Promise<ActivationSavedReport | undefined>;
    write(
      scope: ActivationAdminScope,
      record: ActivationSavedReport,
      signal?: AbortSignal,
    ): Promise<void>;
  };
};

export class ActivationAdminProblem extends Problem {
  constructor(detail: string, denied = false) {
    super(
      denied ? "admin-core/activation-denied" : "admin-core/activation-invalid-report",
      denied ? ProblemCategory.Forbidden : ProblemCategory.ValidationError,
      detail,
    );
  }
}

function sameScope(left: ActivationAdminScope, right: ActivationAdminScope): boolean {
  return (
    left.app === right.app &&
    left.environment === right.environment &&
    left.tenantId === right.tenantId &&
    left.subjectKind === right.subjectKind
  );
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  const encoded = JSON.stringify(value);
  if (encoded === undefined)
    throw new ActivationAdminProblem("Saved report must contain JSON values.");
  return encoded;
}

async function reportHash(record: Omit<ActivationSavedReport, "reportHash">): Promise<string> {
  const bytes = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalJson(record)),
  );
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export class ActivationCandidateOperations {
  constructor(private readonly options: ActivationCandidateOperationsOptions) {}

  private async access(
    write = false,
    expected?: ActivationAdminScope,
    signal?: AbortSignal,
  ): Promise<ActivationAdminScope> {
    signal?.throwIfAborted();
    const access = await this.options.authenticate();
    signal?.throwIfAborted();
    if (
      !access.permissions.includes("activation.read") ||
      (write && !access.permissions.includes("activation.report-write")) ||
      (expected && !sameScope(expected, access.scope))
    ) {
      throw new ActivationAdminProblem(
        "Activation access denied or authenticated scope changed.",
        true,
      );
    }
    if (
      [access.scope.app, access.scope.environment, access.scope.tenantId].some(
        (value) => typeof value !== "string" || !value.trim(),
      ) ||
      (access.scope.subjectKind !== "user" && access.scope.subjectKind !== "account")
    ) {
      throw new ActivationAdminProblem("Authenticated activation scope is incomplete.", true);
    }
    return { ...access.scope };
  }

  private async calculate(
    scope: ActivationAdminScope,
    write: boolean,
    sourceRunRef?: string,
    signal?: AbortSignal,
  ) {
    const input = structuredClone(await this.options.loadInput(scope, sourceRunRef, signal));
    await this.access(write, scope, signal);
    if (
      input.definition.subjectKind !== scope.subjectKind ||
      (sourceRunRef !== undefined && input.definition.sourceRunRef !== sourceRunRef)
    ) {
      throw new ActivationAdminProblem(
        "Source run or subject kind does not match the authorized report.",
      );
    }
    const report = calculateActivationCandidates(input.rows, input.definition);
    const hashes = await hashActivationInputs(input.rows, input.definition);
    await this.access(write, scope, signal);
    return { report, ...hashes };
  }

  async load(signal?: AbortSignal): Promise<ActivationReport> {
    const scope = await this.access(false, undefined, signal);
    return (await this.calculate(scope, false, undefined, signal)).report;
  }

  async save(
    id: string,
    candidateId: string,
    cohort: "new" | "returning",
    expectedReport: ActivationReport,
    signal?: AbortSignal,
  ): Promise<ActivationSavedReport> {
    if (!id.trim()) throw new ActivationAdminProblem("Saved report ID is required.");
    const scope = await this.access(true, undefined, signal);
    const calculated = await this.calculate(
      scope,
      true,
      expectedReport.definition.sourceRunRef,
      signal,
    );
    if (canonicalJson(expectedReport) !== canonicalJson(calculated.report)) {
      throw new ActivationAdminProblem(
        "Activation evidence changed. Reload the report before saving.",
      );
    }
    if (
      !calculated.report.candidates.some(
        (value) => value.candidate.id === candidateId && value.cohort === cohort,
      )
    ) {
      throw new ActivationAdminProblem(
        "Selected activation candidate is absent from the source report.",
      );
    }
    const payload: Omit<ActivationSavedReport, "reportHash"> = {
      id,
      scope,
      ...calculated,
      sourceRunRef: calculated.report.definition.sourceRunRef,
      selectedCandidateId: candidateId,
      selectedCohort: cohort,
    };
    const record = { ...payload, reportHash: await reportHash(payload) };
    await this.access(true, scope, signal);
    await this.options.store.write(scope, structuredClone(record), signal);
    await this.access(true, scope, signal);
    const saved = await this.read(id, signal);
    await this.access(true, scope, signal);
    if (!sameScope(scope, saved.scope))
      throw new ActivationAdminProblem("Saved scope changed.", true);
    return saved;
  }

  async read(id: string, signal?: AbortSignal): Promise<ActivationSavedReport> {
    const scope = await this.access(false, undefined, signal);
    const record = await this.options.store.read(scope, id, signal);
    await this.access(false, scope, signal);
    if (!record || record.id !== id || !sameScope(scope, record.scope)) {
      throw new ActivationAdminProblem(
        "Saved activation report is missing or outside the authorized scope.",
      );
    }
    const { reportHash: digest, ...payload } = record;
    if (digest !== (await reportHash(payload)))
      throw new ActivationAdminProblem("Saved report digest changed.");
    await this.access(false, scope, signal);
    const calculated = await this.calculate(scope, false, record.sourceRunRef, signal);
    if (
      record.definitionHash !== calculated.definitionHash ||
      record.inputHash !== calculated.inputHash ||
      canonicalJson(record.report) !== canonicalJson(calculated.report) ||
      !calculated.report.candidates.some(
        (value) =>
          value.candidate.id === record.selectedCandidateId &&
          value.cohort === record.selectedCohort,
      )
    ) {
      throw new ActivationAdminProblem(
        "Saved activation report failed source and digest verification.",
      );
    }
    // Construct the public record from verified fields; never forward arbitrary stored properties.
    return {
      id,
      scope,
      ...calculated,
      reportHash: record.reportHash,
      sourceRunRef: calculated.report.definition.sourceRunRef,
      selectedCandidateId: record.selectedCandidateId,
      selectedCohort: record.selectedCohort,
    };
  }

  async export(id: string, signal?: AbortSignal): Promise<string> {
    return JSON.stringify(await this.read(id, signal), null, 2);
  }
}
