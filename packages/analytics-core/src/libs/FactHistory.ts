import { Problem, ProblemCategory } from "@croco/problems-core";

export type FactScope = {
  readonly app: string;
  readonly environment: string;
  readonly tenantId: string | null;
};
export type FactSubject = { readonly kind: "user" | "tenant" | "anonymous"; readonly id: string };
export type FactValue =
  | null
  | boolean
  | number
  | string
  | readonly FactValue[]
  | { readonly [key: string]: FactValue };
export type FactDefinition = {
  readonly id: string;
  readonly version: string;
  readonly validate: (value: FactValue) => boolean;
  readonly sourcePriority?: readonly string[];
};
export type FactProjection = {
  readonly subject: FactSubject;
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly projectionId: string;
  readonly projectionRowKey: string;
  readonly materializationRevision: string;
  readonly value: FactValue;
  readonly validFrom: string;
  readonly validTo?: string;
  readonly supersedes?: string;
};
export type FactCorrection = {
  readonly actor: string;
  readonly reason: string;
  readonly expectedRevision: number;
  readonly idempotencyKey: string;
};
export type AppendFactsInput = {
  readonly scope: FactScope;
  readonly source: string;
  readonly sourceEventId: string;
  readonly sourceFingerprint: string;
  readonly rows: readonly FactProjection[];
  readonly correction?: FactCorrection;
};
export type FactRow = FactProjection & {
  readonly id: string;
  readonly scope: FactScope;
  readonly source: string;
  readonly sourceEventId: string;
  readonly recordedAt: string;
  readonly correction?: FactCorrection;
};
export type ReadFactsAtInput = {
  readonly scope: FactScope;
  readonly subject: FactSubject;
  readonly definitionId: string;
  readonly definitionVersion: string;
  readonly materializationRevision: string;
  readonly effectiveAt: string;
  readonly knownAt?: string;
};
export type FactReadResult = {
  readonly status: "known" | "unknown" | "conflict";
  readonly value?: FactValue;
  readonly provenance: readonly FactRow[];
  readonly effectiveAt: string;
  readonly knownAt: string;
};
export type FactHistoryQuery = Omit<ReadFactsAtInput, "effectiveAt"> & {
  readonly knownAt: string;
  readonly limit: number;
};
export type AppendFactsResult = { readonly rows: readonly FactRow[]; readonly revision: number };
export interface FactHistoryStore {
  appendFacts(input: AppendFactsInput, recordedAt: string): Promise<AppendFactsResult>;
  readHistory(input: FactHistoryQuery): Promise<readonly FactRow[]>;
  getRevision(scope: FactScope): Promise<number>;
  deleteSubject(scope: FactScope, subject: FactSubject): Promise<void>;
}
export type FactAuthorizationRequest = {
  readonly action: "read" | "write" | "correct" | "delete";
  readonly scope: FactScope;
  readonly subject: FactSubject;
  readonly definitionId?: string;
  readonly actor?: string;
};
export type FactHistoryPolicy = {
  readonly authorize: (request: FactAuthorizationRequest) => void | Promise<void>;
  readonly mask: (row: FactRow) => FactRow;
};
export type FactHistoryProblemCode =
  | "invalid-input"
  | "invalid-value"
  | "source-conflict"
  | "projection-conflict"
  | "revision-conflict"
  | "denied"
  | "deleted"
  | "history-limit"
  | "persistence-failed";
const FACT_HISTORY_PROBLEMS = {
  "invalid-input": {
    code: "analytics/fact-history/invalid-input",
    category: ProblemCategory.ValidationError,
  },
  "invalid-value": {
    code: "analytics/fact-history/invalid-value",
    category: ProblemCategory.ValidationError,
  },
  "source-conflict": {
    code: "analytics/fact-history/source-conflict",
    category: ProblemCategory.Conflict,
  },
  "projection-conflict": {
    code: "analytics/fact-history/projection-conflict",
    category: ProblemCategory.Conflict,
  },
  "revision-conflict": {
    code: "analytics/fact-history/revision-conflict",
    category: ProblemCategory.Conflict,
  },
  denied: { code: "analytics/fact-history/denied", category: ProblemCategory.Forbidden },
  deleted: { code: "analytics/fact-history/deleted", category: ProblemCategory.Gone },
  "history-limit": {
    code: "analytics/fact-history/history-limit",
    category: ProblemCategory.ValidationError,
  },
  "persistence-failed": {
    code: "analytics/fact-history/persistence-failed",
    category: ProblemCategory.InternalServerError,
  },
} satisfies Record<
  FactHistoryProblemCode,
  { readonly code: string; readonly category: ProblemCategory }
>;
export class FactHistoryProblem extends Problem {
  readonly code: string;
  readonly category: ProblemCategory;
  constructor(code: FactHistoryProblemCode, message: string, cause?: Error) {
    const metadata = FACT_HISTORY_PROBLEMS[code];
    super(metadata.code, metadata.category, message, { cause });
    this.code = metadata.code;
    this.category = metadata.category;
  }
}

export function factScopeKey(scope: FactScope): string {
  return JSON.stringify([scope.app, scope.environment, scope.tenantId]);
}
export function factSubjectKey(subject: FactSubject): string {
  return JSON.stringify([subject.kind, subject.id]);
}
export function factProjectionKey(row: FactProjection): string {
  return JSON.stringify([
    row.subject.kind,
    row.subject.id,
    row.definitionId,
    row.projectionId,
    row.projectionRowKey,
    row.materializationRevision,
  ]);
}
export function canonicalFactValue(value: FactValue): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalFactValue).join(",")}]`;
  const record = value as { readonly [key: string]: FactValue };
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalFactValue(record[key])}`)
    .join(",")}}`;
}

function requireText(value: unknown, name: string): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0)
    throw new FactHistoryProblem("invalid-input", `${name} is required`);
}
function timestamp(value: string): number {
  if (
    typeof value !== "string" ||
    !/(Z|[+-]\d{2}:\d{2})$/.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    throw new FactHistoryProblem("invalid-input", "Fact timestamps must include a valid timezone");
  }
  return Date.parse(value);
}
export function validateFactScope(scope: FactScope): void {
  requireText(scope.app, "app");
  requireText(scope.environment, "environment");
  if (scope.tenantId !== null) requireText(scope.tenantId, "tenantId");
}
export function validateFactSubject(subject: FactSubject): void {
  if (!["user", "tenant", "anonymous"].includes(subject.kind))
    throw new FactHistoryProblem("invalid-input", "Unsupported subject kind");
  requireText(subject.id, "subject.id");
}
function validValue(value: FactValue): boolean {
  if (value === null || typeof value === "string" || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(validValue);
  if (typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return false;
  return Object.values(value).every(validValue);
}
export function evaluateFactsAt(
  rows: readonly FactRow[],
  query: ReadFactsAtInput & { readonly knownAt: string },
  definition: FactDefinition,
): FactReadResult {
  const effective = timestamp(query.effectiveAt);
  const known = timestamp(query.knownAt);
  const visible = rows.filter(
    (row) =>
      factScopeKey(row.scope) === factScopeKey(query.scope) &&
      factSubjectKey(row.subject) === factSubjectKey(query.subject) &&
      row.definitionId === query.definitionId &&
      row.definitionVersion === query.definitionVersion &&
      row.materializationRevision === query.materializationRevision &&
      timestamp(row.recordedAt) <= known,
  );
  const candidates = visible.filter(
    (row) =>
      timestamp(row.validFrom) <= effective &&
      (row.validTo === undefined || effective < timestamp(row.validTo)),
  );
  const superseded = new Set(candidates.flatMap((row) => (row.supersedes ? [row.supersedes] : [])));
  let active = candidates.filter((row) => !superseded.has(row.id));
  if (definition.sourcePriority && active.length > 1) {
    const priorities = definition.sourcePriority;
    const rank = (row: FactRow) => {
      const index = priorities.indexOf(row.source);
      return index === -1 ? priorities.length : index;
    };
    const best = Math.min(...active.map(rank));
    active = active.filter((row) => rank(row) === best);
  }
  const values = new Set(active.map((row) => canonicalFactValue(row.value)));
  const status = active.length === 0 ? "unknown" : values.size === 1 ? "known" : "conflict";
  return {
    status,
    ...(status === "known" ? { value: active[0].value } : {}),
    provenance: active,
    effectiveAt: query.effectiveAt,
    knownAt: query.knownAt,
  };
}

export class FactHistoryService {
  constructor(
    private readonly store: FactHistoryStore,
    private readonly definitions: readonly FactDefinition[],
    private readonly policy: FactHistoryPolicy,
    private readonly clock: () => Date = () => new Date(),
  ) {
    const keys = definitions.map((definition) =>
      JSON.stringify([definition.id, definition.version]),
    );
    if (new Set(keys).size !== keys.length)
      throw new FactHistoryProblem("invalid-input", "Duplicate fact definition version");
  }
  private definition(id: string, version: string): FactDefinition {
    const definition = this.definitions.find(
      (entry) => entry.id === id && entry.version === version,
    );
    if (!definition)
      throw new FactHistoryProblem("invalid-input", "Unknown fact definition version");
    return definition;
  }
  appendFact(
    input: Omit<AppendFactsInput, "rows"> & { readonly row: FactProjection },
  ): Promise<AppendFactsResult> {
    const { row, ...batch } = input;
    return this.appendFacts({ ...batch, rows: [row] });
  }
  async appendFacts(input: AppendFactsInput): Promise<AppendFactsResult> {
    validateFactScope(input.scope);
    requireText(input.source, "source");
    requireText(input.sourceEventId, "sourceEventId");
    requireText(input.sourceFingerprint, "sourceFingerprint");
    if (input.rows.length === 0 || input.rows.length > 100)
      throw new FactHistoryProblem("invalid-input", "Atomic batches require 1 to 100 rows");
    if (new Set(input.rows.map((row) => row.materializationRevision)).size !== 1)
      throw new FactHistoryProblem(
        "invalid-input",
        "Atomic batch rows must share one materialization revision",
      );
    if (input.correction) {
      requireText(input.correction.actor, "actor");
      requireText(input.correction.reason, "reason");
      requireText(input.correction.idempotencyKey, "idempotencyKey");
      if (
        !Number.isSafeInteger(input.correction.expectedRevision) ||
        input.correction.expectedRevision < 0
      )
        throw new FactHistoryProblem("invalid-input", "Invalid expectedRevision");
    }
    const identities = new Set<string>();
    for (const row of input.rows) {
      validateFactSubject(row.subject);
      for (const key of [
        "definitionId",
        "definitionVersion",
        "projectionId",
        "projectionRowKey",
        "materializationRevision",
      ] as const)
        requireText(row[key], key);
      const definition = this.definition(row.definitionId, row.definitionVersion);
      let schemaValid = false;
      try {
        schemaValid = validValue(row.value) && definition.validate(row.value);
      } catch (cause) {
        throw new FactHistoryProblem(
          "invalid-value",
          "Fact value failed its definition schema",
          cause instanceof Error ? cause : new Error(String(cause)),
        );
      }
      if (!schemaValid)
        throw new FactHistoryProblem("invalid-value", "Fact value failed its definition schema");
      if (row.validTo !== undefined && timestamp(row.validTo) <= timestamp(row.validFrom))
        throw new FactHistoryProblem("invalid-input", "validTo must follow validFrom");
      timestamp(row.validFrom);
      if (Boolean(row.supersedes) !== Boolean(input.correction))
        throw new FactHistoryProblem(
          "invalid-input",
          "Corrections require supersedes and correction metadata",
        );
      const identity = factProjectionKey(row);
      if (identities.has(identity))
        throw new FactHistoryProblem(
          "projection-conflict",
          "Duplicate projection identity in batch",
        );
      identities.add(identity);
      await this.policy.authorize({
        action: input.correction ? "correct" : "write",
        scope: input.scope,
        subject: row.subject,
        definitionId: row.definitionId,
        actor: input.correction?.actor,
      });
    }
    return this.store.appendFacts(input, this.clock().toISOString());
  }
  async readHistory(
    input: Omit<FactHistoryQuery, "knownAt"> & { readonly knownAt?: string },
  ): Promise<readonly FactRow[]> {
    return (await this.loadHistory(input)).map((row) => this.policy.mask(row));
  }
  private async loadHistory(
    input: Omit<FactHistoryQuery, "knownAt"> & { readonly knownAt?: string },
  ): Promise<readonly FactRow[]> {
    validateFactScope(input.scope);
    validateFactSubject(input.subject);
    this.definition(input.definitionId, input.definitionVersion);
    requireText(input.materializationRevision, "materializationRevision");
    if (!Number.isSafeInteger(input.limit) || input.limit < 1 || input.limit > 1000)
      throw new FactHistoryProblem("invalid-input", "History limit must be 1 to 1000");
    const knownAt = input.knownAt ?? this.clock().toISOString();
    timestamp(knownAt);
    await this.policy.authorize({
      action: "read",
      scope: input.scope,
      subject: input.subject,
      definitionId: input.definitionId,
    });
    const rows = await this.store.readHistory({ ...input, knownAt });
    if (rows.length > input.limit)
      throw new FactHistoryProblem("history-limit", "History exceeds the bounded query limit");
    return rows;
  }
  async readFactsAt(input: ReadFactsAtInput): Promise<FactReadResult> {
    timestamp(input.effectiveAt);
    const knownAt = input.knownAt ?? this.clock().toISOString();
    const rows = await this.loadHistory({ ...input, knownAt, limit: 1000 });
    const result = evaluateFactsAt(
      rows,
      { ...input, knownAt },
      this.definition(input.definitionId, input.definitionVersion),
    );
    const provenance = result.provenance.map((row) => this.policy.mask(row));
    return {
      ...result,
      ...(result.status === "known" ? { value: provenance[0].value } : {}),
      provenance,
    };
  }
  async getRevision(
    input: Pick<ReadFactsAtInput, "scope" | "subject" | "definitionId" | "definitionVersion">,
  ): Promise<number> {
    validateFactScope(input.scope);
    validateFactSubject(input.subject);
    this.definition(input.definitionId, input.definitionVersion);
    await this.policy.authorize({
      action: "read",
      scope: input.scope,
      subject: input.subject,
      definitionId: input.definitionId,
    });
    return this.store.getRevision(input.scope);
  }
  async deleteSubject(scope: FactScope, subject: FactSubject): Promise<void> {
    validateFactScope(scope);
    validateFactSubject(subject);
    await this.policy.authorize({ action: "delete", scope, subject });
    await this.store.deleteSubject(scope, subject);
  }
}
