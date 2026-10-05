import { Problem, ProblemCategory } from "@croco/problems-core";

export type ExplorerScope = Readonly<{ appId: string; environment: string; tenantId: string }>;
export type ExplorerSubject = Readonly<{ kind: string; id: string }>;
export type ExplorerCandidate = Readonly<{ subject: ExplorerSubject; anchorAt: string }>;
export type SampleQuery = Readonly<{
  scope: ExplorerScope;
  seed: string;
  populationSnapshotId: string;
  targetDefinition: Readonly<{ id: string; revision: number; description: string }>;
  window: Readonly<{ beforeMs: number; afterMs: number }>;
  achieverCount?: number;
  comparisonCount?: number;
}>;
export type ExplorerPopulation = Readonly<{
  snapshotId: string;
  scope: ExplorerScope;
  achievers: readonly ExplorerCandidate[];
  comparisons: readonly ExplorerCandidate[];
}>;
export type Sample = Readonly<{
  id: string;
  scope: ExplorerScope;
  seed: string;
  populationSnapshotId: string;
  populationDigest: string;
  targetDefinition: SampleQuery["targetDefinition"];
  window: SampleQuery["window"];
  ordering: "occurredAt/source/eventId";
  sampledSubjects: readonly (ExplorerCandidate & { group: "achiever" | "comparison" })[];
  excludedN: number;
  createdAt: string;
  expiresAt: string;
  actor: string;
}>;
export type TimelineItem = Readonly<{
  source: string;
  eventId: string;
  occurredAt: string;
  observedAt: string;
  kind: string;
  subject: ExplorerSubject;
  objectRef?: string;
  safeProperties: Readonly<Record<string, string | number | boolean | null>>;
  completeness: "complete" | "delayed" | "partial";
}>;
export type ExplorerSourceStatus = "complete" | "partial" | "delayed" | "denied" | "failed";
export type TimelineRequest = Readonly<{
  scope: ExplorerScope;
  subject: ExplorerSubject;
  from: string;
  to: string;
  limit: number;
  cursor?: string;
}>;
export type TimelineSourcePage = Readonly<{
  items: readonly TimelineItem[];
  status: ExplorerSourceStatus;
  nextCursor?: string;
  truncated: boolean;
}>;
export interface TimelineSource {
  readonly id: string;
  read(request: TimelineRequest): Promise<TimelineSourcePage>;
  resolve(
    scope: ExplorerScope,
    subject: ExplorerSubject,
    eventId: string,
  ): Promise<TimelineItem | undefined>;
}
export type ExplorerEventRef = Readonly<{
  source: string;
  eventId: string;
  subject: ExplorerSubject;
}>;
export type ExplorerNote = Readonly<{
  id: string;
  sampleId: string;
  scope: ExplorerScope;
  subject: ExplorerSubject;
  kind: "fact" | "hypothesis";
  eventRefs: readonly ExplorerEventRef[];
  text: string;
  author: string;
  revision: number;
  updatedAt: string;
  expiresAt: string;
}>;
export type ExplorerNoteAudit = Readonly<{
  noteId: string;
  revision: number;
  actor: string;
  action: "save" | "delete";
  at: string;
}>;
export interface CustomerExplorerRepository {
  createSample(sample: Sample): Promise<void>;
  getSample(scope: ExplorerScope, id: string, now: string): Promise<Sample | undefined>;
  deleteSample(scope: ExplorerScope, id: string): Promise<void>;
  listNotes(scope: ExplorerScope, sampleId: string, now: string): Promise<readonly ExplorerNote[]>;
  saveNote(note: ExplorerNote, expectedRevision: number): Promise<void>;
  deleteNote(
    scope: ExplorerScope,
    sampleId: string,
    id: string,
    expectedRevision: number,
    actor: string,
    now: string,
  ): Promise<void>;
  listNoteAudit(scope: ExplorerScope, sampleId: string): Promise<readonly ExplorerNoteAudit[]>;
}
export type ExplorerPermission = "read" | "write" | "export";
export type ExplorerAuthorization = Readonly<{
  actor: string;
  authorize(scope: ExplorerScope, permission: ExplorerPermission): Promise<boolean>;
}>;
export type ExplorerTimeline = Readonly<{
  items: readonly (TimelineItem & { relativeMs: number; phase: "before" | "anchor" | "after" })[];
  sources: readonly Readonly<{
    source: string;
    status: ExplorerSourceStatus;
    truncated: boolean;
  }>[];
  nextCursors: Readonly<Record<string, string>>;
}>;
export type ExplorerQueryDraft = Readonly<{
  version: 1;
  scope: ExplorerScope;
  sampleId: string;
  populationSnapshotId: string;
  targetDefinition: SampleQuery["targetDefinition"];
  window: SampleQuery["window"];
  conditions: readonly Readonly<{
    kind: string;
    source: string;
    phase: "before" | "after" | "anchor";
  }>[];
}>;
export type ExplorerProblemCode =
  | "input"
  | "denied"
  | "revision-conflict"
  | "source-failed"
  | "not-found";
export class CustomerExplorerProblem extends Problem {
  constructor(code: ExplorerProblemCode, detail: string) {
    super(
      `customer-explorer/${code}`,
      code === "denied"
        ? ProblemCategory.Forbidden
        : code === "revision-conflict"
          ? ProblemCategory.Conflict
          : code === "not-found"
            ? ProblemCategory.NotFound
            : code === "source-failed"
              ? ProblemCategory.InternalServerError
              : ProblemCategory.ValidationError,
      detail,
    );
  }
}

function invalid(message: string): never {
  throw new CustomerExplorerProblem("input", message);
}
export function explorerScopeKey(scope: ExplorerScope): string {
  if (
    !scope ||
    ![scope.appId, scope.environment, scope.tenantId].every(
      (v) => typeof v === "string" && v.trim().length > 0,
    )
  )
    invalid("App, environment and tenant are required");
  return JSON.stringify([scope.appId, scope.environment, scope.tenantId]);
}
function nonempty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
function subjectKey(subject: ExplorerSubject): string {
  if (!subject || !nonempty(subject.kind) || !nonempty(subject.id))
    invalid("Subject kind and id are required");
  return JSON.stringify([subject.kind, subject.id]);
}
function instant(value: string): bigint {
  if (typeof value !== "string") invalid("Invalid timestamp");
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.(\d{1,6}))?(Z|[+-]\d{2}:\d{2})$/.exec(
    value,
  );
  if (!match) invalid("Timestamp requires ISO date, timezone and at most six fractional digits");
  const local = Date.parse(`${match[1]}Z`);
  const milliseconds = Date.parse(`${match[1]}${match[3]}`);
  if (
    !Number.isFinite(local) ||
    !Number.isFinite(milliseconds) ||
    new Date(local).toISOString().slice(0, 19) !== match[1]
  )
    invalid("Invalid timestamp");
  return BigInt(milliseconds) * BigInt(1000000) + BigInt((match[2] ?? "").padEnd(9, "0"));
}
function time(value: string): number {
  return Number(instant(value)) / 1000000;
}
function timestamp(value: bigint): string {
  const seconds =
    value >= BigInt(0)
      ? value / BigInt(1000000000)
      : (value - BigInt(999999999)) / BigInt(1000000000);
  const fraction = value - seconds * BigInt(1000000000);
  return `${new Date(Number(seconds * BigInt(1000))).toISOString().slice(0, 19)}.${(fraction / BigInt(1000)).toString().padStart(6, "0")}Z`;
}
function maskText(value: string): string {
  return value
    .replace(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g, "[redacted]")
    .replace(/\+?\d[\d ().-]{7,}\d/g, "[redacted]");
}
function compare(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
async function digest(value: string): Promise<string> {
  return Array.from(
    new Uint8Array(
      await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
    ),
    (byte) => byte.toString(16).padStart(2, "0"),
  ).join("");
}
export async function createCustomerExplorerSample(
  query: SampleQuery,
  population: ExplorerPopulation,
  metadata: Readonly<{ id: string; actor: string; createdAt: string; expiresAt: string }>,
): Promise<Sample> {
  if (
    !query ||
    !population ||
    !metadata ||
    !query.targetDefinition ||
    !query.window ||
    !Array.isArray(population.achievers) ||
    !Array.isArray(population.comparisons)
  )
    invalid("Sample query and population are required");
  if (
    explorerScopeKey(query.scope) !== explorerScopeKey(population.scope) ||
    query.populationSnapshotId !== population.snapshotId
  )
    invalid("Population scope or snapshot mismatch");
  if (
    !nonempty(metadata.id) ||
    !nonempty(metadata.actor) ||
    !nonempty(query.seed) ||
    !nonempty(population.snapshotId) ||
    !nonempty(query.targetDefinition.id) ||
    !Number.isSafeInteger(query.targetDefinition.revision) ||
    query.targetDefinition.revision < 1
  )
    invalid("Sample identity and definition revision are required");
  if (time(metadata.expiresAt) <= time(metadata.createdAt))
    invalid("Sample expiry must follow creation");
  if (
    ![query.window.beforeMs, query.window.afterMs].every(
      (n) => Number.isSafeInteger(n) && n >= 0 && n <= 366 * 86400000,
    )
  )
    invalid("Invalid timeline window");
  const counts = [query.achieverCount ?? 10, query.comparisonCount ?? 5];
  if (!counts.every((n) => Number.isSafeInteger(n) && n >= 0 && n <= 100) || counts[0] === 0)
    invalid("Sample counts must be bounded by 100 with at least one achiever");
  const seen = new Set<string>();
  const candidates = [
    ...population.achievers.map((candidate) => ({ ...candidate, group: "achiever" as const })),
    ...population.comparisons.map((candidate) => ({ ...candidate, group: "comparison" as const })),
  ];
  for (const candidate of candidates) {
    const key = subjectKey(candidate.subject);
    if (seen.has(key)) invalid("Duplicate population subject");
    seen.add(key);
    time(candidate.anchorAt);
  }
  const canonical = candidates
    .map((c) => JSON.stringify([c.group, subjectKey(c.subject), timestamp(instant(c.anchorAt))]))
    .sort(compare);
  const ranked = await Promise.all(
    candidates.map(async (candidate) => ({
      candidate,
      rank: await digest(
        JSON.stringify([query.seed, population.snapshotId, subjectKey(candidate.subject)]),
      ),
    })),
  );
  ranked.sort(
    (a, b) =>
      compare(a.rank, b.rank) ||
      compare(subjectKey(a.candidate.subject), subjectKey(b.candidate.subject)),
  );
  const sampledSubjects = ["achiever", "comparison"].flatMap((group, index) =>
    ranked
      .filter((r) => r.candidate.group === group)
      .slice(0, counts[index])
      .map((r) => r.candidate),
  );
  return structuredClone({
    ...metadata,
    scope: query.scope,
    seed: query.seed,
    populationSnapshotId: population.snapshotId,
    populationDigest: await digest(JSON.stringify(canonical)),
    targetDefinition: query.targetDefinition,
    window: query.window,
    ordering: "occurredAt/source/eventId",
    sampledSubjects,
    excludedN: candidates.length - sampledSubjects.length,
  });
}

export type ExplorerNoteInput = Readonly<{
  id: string;
  subject: ExplorerSubject;
  kind: "fact" | "hypothesis";
  eventRefs: readonly ExplorerEventRef[];
  text: string;
  expectedRevision: number;
}>;
export type ExplorerResolvedNote = ExplorerNote &
  Readonly<{
    references: readonly Readonly<{ ref: ExplorerEventRef; status: "available" | "unavailable" }>[];
  }>;
export type CustomerExplorerOptions = Readonly<{
  repository: CustomerExplorerRepository;
  sources: readonly TimelineSource[];
  authorization: ExplorerAuthorization;
  allowedProperties: Readonly<Record<string, readonly string[]>>;
  now: () => string;
  maxRetentionMs: number;
}>;
export class CustomerExplorerService {
  constructor(private readonly options: CustomerExplorerOptions) {
    if (
      !Number.isSafeInteger(options.maxRetentionMs) ||
      options.maxRetentionMs <= 0 ||
      !options.authorization.actor?.trim()
    )
      invalid("Actor and positive retention are required");
    const ids = options.sources.map((source) => source.id);
    if (ids.length === 0 || ids.some((id) => !id.trim()) || new Set(ids).size !== ids.length)
      invalid("Sources require unique ids");
  }
  private async authorize(scope: ExplorerScope, permission: ExplorerPermission): Promise<void> {
    explorerScopeKey(scope);
    if (!(await this.options.authorization.authorize(scope, permission)))
      throw new CustomerExplorerProblem("denied", "Customer explorer permission denied");
  }
  async sample(
    query: SampleQuery,
    population: ExplorerPopulation,
    metadata: Readonly<{ id: string; expiresAt: string }>,
  ): Promise<Sample> {
    if (!query || !metadata) invalid("Sample query and metadata are required");
    await this.authorize(query.scope, "write");
    const createdAt = this.options.now();
    if (time(metadata.expiresAt) - time(createdAt) > this.options.maxRetentionMs)
      invalid("Sample retention exceeds policy");
    const sample = await createCustomerExplorerSample(query, population, {
      ...metadata,
      createdAt,
      actor: this.options.authorization.actor,
    });
    await this.options.repository.createSample(sample);
    return sample;
  }
  async getSample(scope: ExplorerScope, id: string): Promise<Sample> {
    await this.authorize(scope, "read");
    if (!nonempty(id)) invalid("Sample id is required");
    const sample = await this.options.repository.getSample(scope, id, this.options.now());
    if (
      !sample ||
      explorerScopeKey(sample.scope) !== explorerScopeKey(scope) ||
      time(sample.expiresAt) <= time(this.options.now())
    )
      throw new CustomerExplorerProblem("not-found", "Sample unavailable or expired");
    return sample;
  }
  private member(sample: Sample, subject: ExplorerSubject): ExplorerCandidate {
    const candidate = sample.sampledSubjects.find(
      (entry) => subjectKey(entry.subject) === subjectKey(subject),
    );
    if (!candidate) invalid("Subject is outside this sample");
    return candidate;
  }
  private sanitize(item: TimelineItem): TimelineItem {
    const allowed = this.options.allowedProperties[item.source] ?? [];
    const safeProperties = Object.fromEntries(
      Object.entries(item.safeProperties)
        .filter(
          ([key]) =>
            allowed.includes(key) &&
            !/email|phone|address|token|secret|password|raw|name/i.test(key),
        )
        .map(([key, value]) => [
          key,
          typeof value === "string" ? maskText(value).slice(0, 500) : value,
        ]),
    );
    return {
      source: item.source,
      eventId: item.eventId,
      occurredAt: item.occurredAt,
      observedAt: item.observedAt,
      kind: item.kind,
      subject: item.subject,
      safeProperties,
      completeness: item.completeness,
    };
  }
  async timeline(
    scope: ExplorerScope,
    sampleId: string,
    subject: ExplorerSubject,
    options: Readonly<{ limit?: number; cursors?: Readonly<Record<string, string>> }> = {},
  ): Promise<ExplorerTimeline> {
    const sample = await this.getSample(scope, sampleId);
    const anchor = instant(this.member(sample, subject).anchorAt);
    if (
      !options ||
      (options.cursors !== undefined &&
        (!options.cursors ||
          typeof options.cursors !== "object" ||
          Array.isArray(options.cursors) ||
          Object.values(options.cursors).some((cursor) => !nonempty(cursor))))
    )
      invalid("Invalid timeline options");
    const limit = options.limit ?? 50;
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200)
      invalid("Timeline page limit must be 1–200 per source");
    if (
      Object.keys(options.cursors ?? {}).some(
        (id) => !this.options.sources.some((source) => source.id === id),
      )
    )
      invalid("Unknown source cursor");
    const from = timestamp(anchor - BigInt(sample.window.beforeMs) * BigInt(1000000));
    const to = timestamp(anchor + BigInt(sample.window.afterMs) * BigInt(1000000));
    const pages = await Promise.all(
      this.options.sources.map(async (source) => {
        let sourceReturned = false;
        try {
          const page = await source.read({
            scope,
            subject,
            from,
            to,
            limit,
            ...(options.cursors?.[source.id] ? { cursor: options.cursors[source.id] } : {}),
          });
          sourceReturned = true;
          if (
            !page ||
            !Array.isArray(page.items) ||
            !["complete", "partial", "delayed", "denied", "failed"].includes(page.status) ||
            typeof page.truncated !== "boolean" ||
            (page.nextCursor !== undefined && !nonempty(page.nextCursor))
          )
            throw new CustomerExplorerProblem("source-failed", "Invalid source page");
          const keys = page.items.map((item) => item.eventId);
          if (
            new Set(keys).size !== keys.length ||
            page.items.some(
              (item) =>
                !item.eventId.trim() ||
                !item.kind.trim() ||
                !Number.isFinite(time(item.observedAt)) ||
                Object.values(item.safeProperties).some(
                  (value) =>
                    value !== null &&
                    typeof value !== "string" &&
                    typeof value !== "boolean" &&
                    !(typeof value === "number" && Number.isFinite(value)),
                ),
            )
          )
            throw new CustomerExplorerProblem("source-failed", "Invalid source item");
          if (
            page.items.length > limit ||
            page.items.some(
              (item) =>
                item.source !== source.id ||
                subjectKey(item.subject) !== subjectKey(subject) ||
                instant(item.occurredAt) < instant(from) ||
                instant(item.occurredAt) > instant(to),
            )
          )
            throw new CustomerExplorerProblem(
              "source-failed",
              "Source violated subject page boundary",
            );
          if ((page.status === "failed" || page.status === "denied") && page.items.length)
            throw new CustomerExplorerProblem("source-failed", "Unavailable source returned rows");
          return { source: source.id, page };
        } catch (error) {
          if (
            !sourceReturned &&
            error instanceof CustomerExplorerProblem &&
            error.code === "customer-explorer/input"
          )
            throw error;
          return {
            source: source.id,
            page: {
              items: [],
              status:
                error instanceof Problem && error.category === ProblemCategory.Forbidden
                  ? "denied"
                  : "failed",
              truncated: false,
            } as TimelineSourcePage,
          };
        }
      }),
    );
    const items = pages.flatMap(({ page }) =>
      page.items.map((item) => {
        const relativeMs = Number(instant(item.occurredAt) - anchor) / 1000000;
        return {
          ...this.sanitize(item),
          relativeMs,
          phase:
            relativeMs < 0
              ? ("before" as const)
              : relativeMs > 0
                ? ("after" as const)
                : ("anchor" as const),
        };
      }),
    );
    items.sort(
      (a, b) =>
        Number(instant(a.occurredAt) - instant(b.occurredAt)) ||
        compare(a.source, b.source) ||
        compare(a.eventId, b.eventId),
    );
    return {
      items,
      sources: pages.map(({ source, page }) => ({
        source,
        status: page.status,
        truncated: page.truncated,
      })),
      nextCursors: Object.fromEntries(
        pages.flatMap(({ source, page }) => (page.nextCursor ? [[source, page.nextCursor]] : [])),
      ),
    };
  }
  async notes(scope: ExplorerScope, sampleId: string): Promise<readonly ExplorerResolvedNote[]> {
    const sample = await this.getSample(scope, sampleId);
    const notes = await this.options.repository.listNotes(scope, sampleId, this.options.now());
    return Promise.all(
      notes.map(async (note) => {
        this.member(sample, note.subject);
        const references = await Promise.all(
          note.eventRefs.map(async (ref) => {
            const source = this.options.sources.find((candidate) => candidate.id === ref.source);
            if (!source) return { ref, status: "unavailable" as const };
            let item: TimelineItem | undefined;
            try {
              item = await source.resolve(scope, ref.subject, ref.eventId);
            } catch {
              throw new CustomerExplorerProblem("source-failed", "Note reference source failed");
            }
            return {
              ref,
              status:
                item &&
                item.source === ref.source &&
                item.eventId === ref.eventId &&
                subjectKey(item.subject) === subjectKey(ref.subject)
                  ? ("available" as const)
                  : ("unavailable" as const),
            };
          }),
        );
        return { ...note, references };
      }),
    );
  }
  async saveNote(
    scope: ExplorerScope,
    sampleId: string,
    input: ExplorerNoteInput,
  ): Promise<ExplorerNote> {
    await this.authorize(scope, "write");
    const sample = await this.getSample(scope, sampleId);
    if (!input) invalid("Note input is required");
    this.member(sample, input.subject);
    if (
      !nonempty(input.id) ||
      !nonempty(input.text) ||
      input.text.length > 10000 ||
      !["fact", "hypothesis"].includes(input.kind) ||
      !Number.isSafeInteger(input.expectedRevision) ||
      input.expectedRevision < 0 ||
      !Array.isArray(input.eventRefs) ||
      input.eventRefs.length > 100
    )
      invalid("Invalid note input");
    for (const ref of input.eventRefs) {
      if (
        !ref ||
        subjectKey(ref.subject) !== subjectKey(input.subject) ||
        !this.options.sources.some((source) => source.id === ref.source) ||
        !nonempty(ref.eventId)
      )
        invalid("Note reference must belong to the selected subject and source");
    }
    const existing = (
      await this.options.repository.listNotes(scope, sampleId, this.options.now())
    ).find((note) => note.id === input.id);
    if ((existing?.revision ?? 0) !== input.expectedRevision)
      throw new CustomerExplorerProblem("revision-conflict", "Note revision changed");
    if (existing && subjectKey(existing.subject) !== subjectKey(input.subject))
      invalid("Note subject cannot be reassigned");
    const anchor = instant(this.member(sample, input.subject).anchorAt);
    for (const ref of input.eventRefs) {
      if (
        existing?.eventRefs.some(
          (previous) =>
            previous.source === ref.source &&
            previous.eventId === ref.eventId &&
            subjectKey(previous.subject) === subjectKey(ref.subject),
        )
      )
        continue;
      const source = this.options.sources.find((candidate) => candidate.id === ref.source);
      if (!source) invalid("Unknown note source");
      let item: TimelineItem | undefined;
      try {
        item = await source.resolve(scope, input.subject, ref.eventId);
      } catch (error) {
        if (error instanceof CustomerExplorerProblem && error.code === "customer-explorer/input")
          throw error;
        throw new CustomerExplorerProblem("source-failed", "Note reference source failed");
      }
      if (
        !item ||
        item.source !== ref.source ||
        item.eventId !== ref.eventId ||
        subjectKey(item.subject) !== subjectKey(input.subject) ||
        instant(item.occurredAt) < anchor - BigInt(sample.window.beforeMs) * BigInt(1000000) ||
        instant(item.occurredAt) > anchor + BigInt(sample.window.afterMs) * BigInt(1000000)
      )
        invalid("Note reference is unavailable or outside the sample window");
    }
    const note: ExplorerNote = {
      id: input.id,
      sampleId,
      scope,
      subject: input.subject,
      kind: input.kind,
      eventRefs: input.eventRefs,
      text: maskText(input.text),
      author: this.options.authorization.actor,
      revision: input.expectedRevision + 1,
      updatedAt: this.options.now(),
      expiresAt: sample.expiresAt,
    };
    await this.options.repository.saveNote(note, input.expectedRevision);
    return note;
  }
  async deleteNote(
    scope: ExplorerScope,
    sampleId: string,
    id: string,
    expectedRevision: number,
  ): Promise<void> {
    await this.authorize(scope, "write");
    await this.getSample(scope, sampleId);
    if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 1)
      invalid("A current note revision is required");
    await this.options.repository.deleteNote(
      scope,
      sampleId,
      id,
      expectedRevision,
      this.options.authorization.actor,
      this.options.now(),
    );
  }
  async deleteSample(scope: ExplorerScope, id: string): Promise<void> {
    await this.authorize(scope, "write");
    await this.options.repository.deleteSample(scope, id);
  }
  async exportDraft(
    scope: ExplorerScope,
    sampleId: string,
    conditions: ExplorerQueryDraft["conditions"],
  ): Promise<ExplorerQueryDraft> {
    await this.authorize(scope, "export");
    const sample = await this.getSample(scope, sampleId);
    if (
      !Array.isArray(conditions) ||
      conditions.length > 100 ||
      conditions.some(
        (condition) =>
          !condition ||
          !nonempty(condition.kind) ||
          !this.options.sources.some((source) => source.id === condition.source) ||
          !["before", "after", "anchor"].includes(condition.phase),
      )
    )
      invalid("Invalid query draft conditions");
    return {
      version: 1,
      scope,
      sampleId,
      populationSnapshotId: sample.populationSnapshotId,
      targetDefinition: sample.targetDefinition,
      window: sample.window,
      conditions: structuredClone(conditions),
    };
  }
}
