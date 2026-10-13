import { Problem, ProblemCategory } from "@croco/problems-core";
import { defineAdminResource } from "./AdminResource";
import { explorerScopeKey } from "./CustomerExplorer";
import type { ExplorerScope } from "./CustomerExplorer";

export type LearningScope = ExplorerScope;
export type HypothesisStatus =
  | "new"
  | "checking"
  | "supported"
  | "refuted"
  | "inconclusive"
  | "unknown";
export type EvidenceAccessState =
  | "available"
  | "deleted"
  | "denied"
  | "failed"
  | "version-mismatch"
  | "unregistered";
/** Opaque source identity. Access state is resolved on reads and never trusted from a mutation. */
export type EvidenceRef = Readonly<{
  source: string;
  id: string;
  version: string;
  observedWindow: Readonly<{ from: string; to: string }>;
  url?: string;
  snapshot?: LearningResultSnapshot;
}>;
/** Aggregate-only imported results. Raw rows, customer properties and arbitrary text are forbidden. */
export type LearningResultSnapshot = Readonly<{
  schemaVersion: 1;
  metrics: readonly Readonly<{ metricId: string; value: number; sampleSize: number }>[];
}>;
export type DecisionRef = Readonly<{ text: string; reference?: EvidenceRef }>;
export type LearningHypothesis = Readonly<{
  text: string;
  state: HypothesisStatus;
  supportRefs: readonly string[];
  limitations: string;
}>;
export type LearningContent = Readonly<{
  question: string;
  desiredOutcome: string;
  facts: readonly string[];
  hypotheses: readonly LearningHypothesis[];
  evidenceRefs: readonly EvidenceRef[];
  decision?: DecisionRef;
  nextActions: readonly string[];
  owner: string;
  status: "draft" | "reviewed" | "archived";
  tags: Readonly<{
    action: readonly string[];
    target: readonly string[];
    metric: readonly string[];
  }>;
}>;
export type LearningRecord = LearningContent &
  Readonly<{
    id: string;
    scope: LearningScope;
    revision: number;
  }>;
export type LearningPermission = "read" | "write" | "transition" | "export" | "share";
/** Must be supplied by the verified server session. The browser never supplies this authority. */
export type LearningAccess = Readonly<{
  scope: LearningScope;
  actor: string;
  principal: unknown;
}>;
export type LearningField = keyof LearningContent;
/** Host policy is re-evaluated on every operation, including history, receipt replay and export. */
export interface LearningPolicy {
  authorize(access: LearningAccess, permission: LearningPermission): Promise<boolean>;
  fields(access: LearningAccess, permission: LearningPermission): Promise<readonly LearningField[]>;
  /** Reject sensitive customer text before persistence; never silently accept unreviewed imports. */
  assertSafe(content: LearningContent, access: LearningAccess, reason?: string): Promise<void>;
}
export type LearningMutation = Readonly<{
  record: LearningRecord;
  expectedRevision: number;
  reason: string;
  idempotencyKey: string;
}>;
export type LearningCommit = LearningMutation &
  Readonly<{
    actor: string;
    /** Derived by the server policy, never accepted from a client mutation. */
    allowStateChange: boolean;
    fingerprint: string;
    at: string;
  }>;
export type LearningRevision = Readonly<{
  record: LearningRecord;
  actor: string;
  reason: string;
  at: string;
}>;
export type LearningQuery = Readonly<{
  after?: string;
  limit?: number;
  text?: string;
  tag?: Readonly<{ kind: "action" | "target" | "metric"; value: string }>;
}>;
/** commit atomically performs CAS, receipt conflict/replay, full revision history and audit. */
export interface LearningRepository {
  commit(command: LearningCommit): Promise<LearningRecord>;
  read(scope: LearningScope, id: string): Promise<LearningRecord | undefined>;
  page(
    scope: LearningScope,
    after: string | undefined,
    limit: number,
  ): Promise<readonly LearningRecord[]>;
  history(
    scope: LearningScope,
    id: string,
    before: number | undefined,
    limit: number,
  ): Promise<readonly LearningRevision[]>;
}
export type LearningEvidenceResult = Readonly<{
  state: Exclude<EvidenceAccessState, "version-mismatch" | "unregistered">;
  version?: string;
}>;
export interface LearningEvidenceSource {
  readonly id: string;
  /** Reauthorize against current source privacy, including retained snapshots. No default URL fetch. */
  resolve(reference: EvidenceRef, access: LearningAccess): Promise<LearningEvidenceResult>;
}
export type LearningView = Readonly<{
  id: string;
  scope: LearningScope;
  revision: number;
  content: Partial<LearningContent>;
  /** False when field policy or source availability hides stored content. Never use a partial view as a replacement document. */
  isComplete: boolean;
  evidence: readonly Readonly<{ reference: EvidenceRef; accessState: EvidenceAccessState }>[];
  hasLearning: boolean;
}>;
export type LearningProblemCode = ConstructorParameters<typeof LearningRegistryProblem>[0];
const LEARNING_PROBLEMS = {
  input: { code: "learning-registry/input", category: ProblemCategory.ValidationError },
  denied: { code: "learning-registry/denied", category: ProblemCategory.Forbidden },
  "not-found": { code: "learning-registry/not-found", category: ProblemCategory.NotFound },
  "revision-conflict": {
    code: "learning-registry/revision-conflict",
    category: ProblemCategory.Conflict,
  },
  "idempotency-conflict": {
    code: "learning-registry/idempotency-conflict",
    category: ProblemCategory.Conflict,
  },
  transition: { code: "learning-registry/transition", category: ProblemCategory.ValidationError },
} as const;
export class LearningRegistryProblem extends Problem {
  constructor(
    code:
      | "input"
      | "denied"
      | "not-found"
      | "revision-conflict"
      | "idempotency-conflict"
      | "transition",
    detail: string,
  ) {
    const definition = LEARNING_PROBLEMS[code];
    super(definition.code, definition.category, detail);
  }
}
export class LearningStorageProblem extends Problem {
  constructor(cause?: Error) {
    super(
      "learning-registry/storage-failed",
      ProblemCategory.InternalServerError,
      "Learning storage did not confirm the operation; retry the same command key",
      { cause },
    );
  }
}
function invalid(detail: string): never {
  throw new LearningRegistryProblem("input", detail);
}
function scopeKey(scope: LearningScope): string {
  try {
    return explorerScopeKey(scope);
  } catch {
    invalid("App, environment and tenant are required");
  }
}
function text(value: unknown, max = 4000): value is string {
  return typeof value === "string" && value.length <= max;
}
function required(value: unknown): value is string {
  return text(value, 200) && value.trim().length > 0;
}
function texts(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length <= 50 && value.every((v) => text(v) && v.trim());
}
function instant(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}
export function learningEvidenceKey(ref: EvidenceRef): string {
  return JSON.stringify([ref.source, ref.id, ref.version]);
}
/** Decode aggregate result references only; parsing never executes note text or fetches a URL. */
export function importLearningEvidence(json: string): EvidenceRef {
  if (typeof json !== "string" || new TextEncoder().encode(json).length > 16384)
    invalid("Evidence import exceeds 16 KiB");
  let ref: EvidenceRef;
  try {
    ref = JSON.parse(json) as EvidenceRef;
  } catch {
    invalid("Invalid evidence JSON");
  }
  validateLearningEvidence(ref);
  return structuredClone(ref);
}
export function validateLearningEvidence(ref: EvidenceRef): void {
  if (
    !ref ||
    !required(ref.source) ||
    !required(ref.id) ||
    !required(ref.version) ||
    !ref.observedWindow ||
    !instant(ref.observedWindow.from) ||
    !instant(ref.observedWindow.to) ||
    Date.parse(ref.observedWindow.from) > Date.parse(ref.observedWindow.to)
  )
    invalid("Evidence requires source, identity, version and an ordered observation window");
  if (ref.url !== undefined) {
    let url: URL;
    try {
      url = new URL(ref.url);
    } catch {
      invalid("Invalid evidence URL");
    }
    if (
      ref.url.length > 2048 ||
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      invalid("Evidence URL requires HTTP(S) without credentials");
  }
  if (Object.keys(ref.observedWindow).some((key) => !["from", "to"].includes(key)))
    invalid("Invalid observation fields");
  if (ref.snapshot !== undefined) {
    const snapshot = ref.snapshot;
    if (
      !snapshot ||
      snapshot.schemaVersion !== 1 ||
      Object.keys(snapshot).some((key) => !["schemaVersion", "metrics"].includes(key)) ||
      !Array.isArray(snapshot.metrics) ||
      snapshot.metrics.length > 50 ||
      snapshot.metrics.some(
        (metric) =>
          !metric ||
          !required(metric.metricId) ||
          !/^[a-zA-Z][a-zA-Z0-9_.-]{0,99}$/.test(metric.metricId) ||
          !Number.isFinite(metric.value) ||
          !Number.isSafeInteger(metric.sampleSize) ||
          metric.sampleSize < 0 ||
          Object.keys(metric).some((key) => !["metricId", "value", "sampleSize"].includes(key)),
      )
    )
      invalid("Snapshot requires bounded aggregate metrics without raw rows or sensitive fields");
  }
  const keys = new Set(["source", "id", "version", "observedWindow", "url", "snapshot"]);
  if (Object.keys(ref).some((key) => !keys.has(key)))
    invalid("Evidence stores references, not source text or snapshots");
}
/** Strict, bounded write schema. Unknown fields cannot become a hidden PII storage channel. */
export function validateLearningRecord(record: LearningRecord): void {
  if (!record || !required(record.id)) invalid("Record identity required");
  scopeKey(record.scope);
  if (Object.keys(record.scope).some((key) => !["appId", "environment", "tenantId"].includes(key)))
    invalid("Invalid scope fields");
  if (
    !Number.isSafeInteger(record.revision) ||
    record.revision < 0 ||
    !text(record.question) ||
    !record.question.trim() ||
    !text(record.desiredOutcome) ||
    !required(record.owner) ||
    !texts(record.facts) ||
    !texts(record.nextActions) ||
    !["draft", "reviewed", "archived"].includes(record.status)
  )
    invalid("Invalid learning content");
  const fields = new Set([
    "id",
    "scope",
    "revision",
    "question",
    "desiredOutcome",
    "facts",
    "hypotheses",
    "evidenceRefs",
    "decision",
    "nextActions",
    "owner",
    "status",
    "tags",
  ]);
  if (
    Object.keys(record).some((key) => !fields.has(key)) ||
    !record.tags ||
    Object.keys(record.tags).some((key) => !["action", "target", "metric"].includes(key)) ||
    ![record.tags.action, record.tags.target, record.tags.metric].every(texts) ||
    !Array.isArray(record.evidenceRefs) ||
    record.evidenceRefs.length > 50 ||
    !Array.isArray(record.hypotheses) ||
    record.hypotheses.length > 50
  )
    invalid("Invalid fields or collection bounds");
  for (const ref of record.evidenceRefs) validateLearningEvidence(ref);
  const references = new Set(record.evidenceRefs.map(learningEvidenceKey));
  if (references.size !== record.evidenceRefs.length) invalid("Duplicate evidence identity");
  for (const hypothesis of record.hypotheses) {
    if (
      !hypothesis ||
      !text(hypothesis.text) ||
      !hypothesis.text.trim() ||
      !["new", "checking", "supported", "refuted", "inconclusive", "unknown"].includes(
        hypothesis.state,
      ) ||
      !texts(hypothesis.supportRefs) ||
      !text(hypothesis.limitations) ||
      Object.keys(hypothesis).some(
        (key) => !["text", "state", "supportRefs", "limitations"].includes(key),
      ) ||
      hypothesis.supportRefs.some((key: string) => !references.has(key))
    )
      invalid("Invalid hypothesis");
    if (
      ["supported", "refuted"].includes(hypothesis.state) &&
      (!hypothesis.supportRefs.length || !hypothesis.limitations.trim())
    )
      invalid(
        "Supported/refuted hypotheses require reviewed evidence and limitations; this does not prove causality",
      );
  }
  if (record.decision !== undefined) {
    if (
      !record.decision ||
      !text(record.decision.text) ||
      !record.decision.text.trim() ||
      Object.keys(record.decision).some((key) => !["text", "reference"].includes(key))
    )
      invalid("Invalid decision");
    if (record.decision.reference) validateLearningEvidence(record.decision.reference);
  }
  if (new TextEncoder().encode(JSON.stringify(record)).length > 65536)
    invalid("Record exceeds 64 KiB");
}
/** Called inside the repository transaction after the receipt check and record lock. */
export function validateLearningCommit(
  current: LearningRecord | undefined,
  command: LearningCommit,
): void {
  validateLearningRecord(command.record);
  if (
    !Number.isSafeInteger(command.expectedRevision) ||
    command.expectedRevision < 0 ||
    command.expectedRevision >= Number.MAX_SAFE_INTEGER ||
    command.record.revision !== command.expectedRevision ||
    !required(command.actor) ||
    !text(command.reason) ||
    !command.reason.trim() ||
    !required(command.idempotencyKey) ||
    !required(command.fingerprint) ||
    !Number.isFinite(Date.parse(command.at))
  )
    invalid("Invalid mutation metadata");
  if ((current?.revision ?? 0) !== command.expectedRevision)
    throw new LearningRegistryProblem(
      "revision-conflict",
      "Record changed; retain the local draft and read the latest revision",
    );
  const changedState = current
    ? current.status !== command.record.status ||
      current.hypotheses.some(
        (hypothesis, index) =>
          hypothesis.state !== "new" &&
          hypothesis.state !== command.record.hypotheses[index]?.state,
      )
    : command.record.status !== "draft";
  if (
    !command.allowStateChange &&
    (changedState || command.record.hypotheses.some((hypothesis) => hypothesis.state !== "new"))
  )
    throw new LearningRegistryProblem(
      "denied",
      "Changing review or hypothesis state requires explicit transition permission",
    );
  if (!current && command.record.status !== "draft")
    throw new LearningRegistryProblem("transition", "Create a draft before reviewing or archiving");
  if (current?.status === "archived" && command.record.status !== "draft")
    throw new LearningRegistryProblem("transition", "Reopen an archived record as a draft");
  if (current?.status === "reviewed" && command.record.status === "reviewed")
    throw new LearningRegistryProblem(
      "transition",
      "Reopen a reviewed record as a draft before editing",
    );
  if (
    current?.status === "reviewed" &&
    command.record.status === "archived" &&
    CONTENT_FIELDS.some(
      (field) =>
        field !== "status" && canonical(current[field]) !== canonical(command.record[field]),
    )
  )
    throw new LearningRegistryProblem(
      "transition",
      "Archive reviewed content unchanged or reopen it as a draft before editing",
    );
}
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  if (value && typeof value === "object")
    return `{${Object.entries(value)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`)
      .join(",")}}`;
  return JSON.stringify(value);
}
async function fingerprint(value: unknown): Promise<string> {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}
const CONTENT_FIELDS: readonly LearningField[] = [
  "question",
  "desiredOutcome",
  "facts",
  "hypotheses",
  "evidenceRefs",
  "decision",
  "nextActions",
  "owner",
  "status",
  "tags",
];
export class LearningRegistry {
  private readonly sources: ReadonlyMap<string, LearningEvidenceSource>;
  constructor(
    private readonly repository: LearningRepository,
    private readonly policy: LearningPolicy,
    sources: readonly LearningEvidenceSource[] = [],
    private readonly now: () => string = () => new Date().toISOString(),
  ) {
    if (
      sources.some((source) => !required(source.id)) ||
      new Set(sources.map((source) => source.id)).size !== sources.length
    )
      invalid("Evidence sources require unique identities");
    this.sources = new Map(sources.map((source) => [source.id, source]));
  }
  private async authorize(
    scope: LearningScope,
    access: LearningAccess,
    permission: LearningPermission,
  ): Promise<readonly LearningField[]> {
    if (
      scopeKey(scope) !== scopeKey(access.scope) ||
      !required(access.actor) ||
      !(await this.policy.authorize(access, permission))
    )
      throw new LearningRegistryProblem("denied", "Learning operation is not authorized");
    return [...(await this.policy.fields(access, permission))];
  }
  private async view(
    record: LearningRecord,
    access: LearningAccess,
    permission: LearningPermission,
  ): Promise<LearningView> {
    const operationFields = await this.authorize(record.scope, access, permission);
    const readFields =
      permission === "read" ? operationFields : await this.authorize(record.scope, access, "read");
    const fields = operationFields.filter((field) => readFields.includes(field));
    const content = Object.fromEntries(
      CONTENT_FIELDS.filter((field) => fields.includes(field)).map((field) => [
        field,
        record[field],
      ]),
    ) as Partial<{ -readonly [K in keyof LearningContent]: LearningContent[K] }>;
    const refs = [
      ...(content.evidenceRefs ?? []),
      ...(content.decision?.reference ? [content.decision.reference] : []),
    ];
    const evidence: LearningView["evidence"] = await Promise.all(
      refs.map(async (reference) => {
        const source = this.sources.get(reference.source);
        let accessState: EvidenceAccessState = "unregistered";
        if (source) {
          try {
            const result = await source.resolve(reference, access);
            accessState =
              result.state === "available" && result.version !== reference.version
                ? "version-mismatch"
                : result.state;
          } catch {
            accessState = "failed";
          }
        }
        return {
          reference: {
            ...reference,
            url: accessState === "available" ? reference.url : undefined,
            snapshot: accessState === "available" ? reference.snapshot : undefined,
          },
          accessState,
        };
      }),
    );
    // URLs never survive denied/deleted/failed evidence, including decision references and exports.
    content.evidenceRefs = evidence
      .slice(0, content.evidenceRefs?.length ?? 0)
      .map((item) => item.reference);
    if (!fields.includes("evidenceRefs")) delete content.evidenceRefs;
    if (content.decision?.reference)
      content.decision = { ...content.decision, reference: evidence.at(-1)?.reference };
    return structuredClone({
      id: record.id,
      scope: record.scope,
      revision: record.revision,
      content,
      isComplete:
        CONTENT_FIELDS.every((field) => fields.includes(field)) &&
        evidence.every(
          (item, index) =>
            item.accessState === "available" || (!refs[index]?.snapshot && !refs[index]?.url),
        ),
      evidence,
      hasLearning: Boolean(
        content.facts?.length || content.hypotheses?.some((h) => h.state !== "new"),
      ),
    });
  }
  async read(scope: LearningScope, id: string, access: LearningAccess): Promise<LearningView> {
    await this.authorize(scope, access, "read");
    if (!required(id)) invalid("Record identity required");
    const record = await this.repository.read(scope, id);
    if (!record) throw new LearningRegistryProblem("not-found", "Learning record unavailable");
    return this.view(record, access, "read");
  }
  async save(input: LearningMutation, access: LearningAccess): Promise<LearningView> {
    if (!input?.record) invalid("Learning mutation required");
    const command = structuredClone(input);
    const fields = await this.authorize(command.record.scope, access, "write");
    const readFields = await this.authorize(command.record.scope, access, "read");
    if (!CONTENT_FIELDS.every((field) => fields.includes(field) && readFields.includes(field)))
      throw new LearningRegistryProblem(
        "denied",
        "Full-record writes require read and write permission for every content field",
      );
    validateLearningRecord(command.record);
    await this.policy.assertSafe(command.record, access, command.reason);
    const receipt = await this.repository.commit({
      ...command,
      actor: access.actor,
      allowStateChange: await this.policy.authorize(access, "transition"),
      fingerprint: await fingerprint({ ...command, actor: access.actor }),
      at: this.now(),
    });
    return this.view(receipt, access, "read");
  }
  async search(
    scope: LearningScope,
    query: LearningQuery,
    access: LearningAccess,
  ): Promise<Readonly<{ rows: readonly LearningView[]; nextAfter?: string }>> {
    await this.authorize(scope, access, "read");
    const limit = query.limit ?? 20;
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      limit > 50 ||
      (query.after !== undefined && !required(query.after)) ||
      (query.text !== undefined && !text(query.text, 200)) ||
      (query.tag &&
        (!["action", "target", "metric"].includes(query.tag.kind) || !required(query.tag.value)))
    )
      invalid("Invalid bounded search");
    const candidates = await this.repository.page(scope, query.after, limit + 1);
    const rows: LearningView[] = [];
    for (const record of candidates.slice(0, limit)) {
      const view = await this.view(record, access, "read");
      if (
        (!query.text ||
          JSON.stringify(view.content).toLowerCase().includes(query.text.toLowerCase())) &&
        (!query.tag || view.content.tags?.[query.tag.kind].includes(query.tag.value))
      )
        rows.push(view);
    }
    return { rows, ...(candidates.length > limit ? { nextAfter: candidates[limit - 1]?.id } : {}) };
  }
  async history(
    scope: LearningScope,
    id: string,
    access: LearningAccess,
    before?: number,
  ): Promise<
    readonly Readonly<{ view: LearningView; actor: string; reason: string; at: string }>[]
  > {
    await this.authorize(scope, access, "read");
    if (!required(id) || (before !== undefined && (!Number.isSafeInteger(before) || before < 1)))
      invalid("Invalid history page");
    const versions = await this.repository.history(scope, id, before, 20);
    const fields = await this.authorize(scope, access, "read");
    return Promise.all(
      versions.map(async (revision) => ({
        view: await this.view(revision.record, access, "read"),
        actor: fields.includes("owner") ? revision.actor : "",
        reason: fields.includes("facts") ? revision.reason : "",
        at: revision.at,
      })),
    );
  }
  /** No cached source bodies or customer logs. Consumers must reauthorize retained exports. */
  async export(
    scope: LearningScope,
    id: string,
    access: LearningAccess,
    permission: "export" | "share" = "export",
  ): Promise<LearningView> {
    if (!["export", "share"].includes(permission) || !required(id))
      invalid("Invalid export request");
    await this.authorize(scope, access, permission);
    const record = await this.repository.read(scope, id);
    if (!record) throw new LearningRegistryProblem("not-found", "Learning record unavailable");
    return this.view(record, access, permission);
  }
  async copyDraft(
    scope: LearningScope,
    id: string,
    newId: string,
    access: LearningAccess,
  ): Promise<LearningRecord> {
    const view = await this.export(scope, id, access);
    if (!view.isComplete)
      throw new LearningRegistryProblem("denied", "Copy requires complete authorized content");
    if (!required(newId) || newId === id) invalid("Copy requires a distinct identity");
    return { ...(view.content as LearningContent), scope, id: newId, revision: 0, status: "draft" };
  }
}

/** Host admin registries consume the same resource, permission and audit contract as other admin tools. */
export const learningRecordResource = defineAdminResource({
  kind: "learning-record",
  label: "Learning records",
  scope: "tenant",
  source: "croco",
  identity: {
    idField: "id",
    labelField: "question",
    statusField: "status",
    versionField: "revision",
  },
  fields: [
    { id: "id", label: "Identity", valueType: "string" },
    { id: "question", label: "Question", valueType: "string", sensitive: true },
    { id: "desiredOutcome", label: "Desired outcome", valueType: "string", sensitive: true },
    { id: "facts", label: "Observed facts", valueType: "json", sensitive: true },
    { id: "hypotheses", label: "Hypotheses and limits", valueType: "json", sensitive: true },
    { id: "evidenceRefs", label: "Evidence references", valueType: "json", sensitive: true },
    { id: "decision", label: "Decision", valueType: "json", sensitive: true },
    { id: "nextActions", label: "Next actions", valueType: "json", sensitive: true },
    { id: "tags", label: "Action / target / metric tags", valueType: "json", sensitive: true },
    { id: "owner", label: "Owner", valueType: "string", sensitive: true },
    { id: "status", label: "Review status", valueType: "status" },
    { id: "revision", label: "Revision", valueType: "number" },
  ],
  list: { fields: ["question", "status", "revision"], pageSize: 20 },
  detail: {
    fields: [
      "id",
      "question",
      "desiredOutcome",
      "facts",
      "hypotheses",
      "evidenceRefs",
      "decision",
      "nextActions",
      "tags",
      "owner",
      "status",
      "revision",
    ],
  },
  actions: [
    {
      id: "save",
      label: "Save learning record",
      kind: "edit",
      target: "record",
      mutability: "write",
      permissions: [{ permissions: ["learning:write"] }],
      idempotency: "required",
      audit: {
        eventName: "learning-record.saved",
        subjectType: "learning-record",
        subjectIdField: "id",
        actor: "required",
        reason: "required",
        idempotencyKey: "required",
      },
      problems: [
        { code: "learning-registry/revision-conflict", retryable: false },
        { code: "learning-registry/idempotency-conflict", retryable: false },
        { code: "learning-registry/denied" },
      ],
    },
  ],
});
