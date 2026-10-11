import { CustomerExplorerProblem, explorerScopeKey } from "@croco/admin-core";
import type {
  CustomerExplorerRepository,
  ExplorerNote,
  ExplorerNoteAudit,
  ExplorerScope,
  ExplorerSourceStatus,
  ExplorerSubject,
  Sample,
  TimelineItem,
  TimelineRequest,
  TimelineSource,
  TimelineSourcePage,
} from "@croco/admin-core";

export interface ExplorerPgExecutor {
  query(text: string, values?: unknown[]): Promise<{ rows: Record<string, unknown>[] }>;
}
export interface ExplorerPgDatabase extends ExplorerPgExecutor {
  connect(): Promise<ExplorerPgExecutor & { release(): void }>;
}
function scopeValues(scope: ExplorerScope): string[] {
  explorerScopeKey(scope);
  return [scope.appId, scope.environment, scope.tenantId];
}
const SCOPE = "app_id=$1 AND environment=$2 AND tenant_id=$3";
function conflict(): never {
  throw new CustomerExplorerProblem("revision-conflict", "Explorer revision or snapshot conflicts");
}
async function transaction<T>(
  database: ExplorerPgDatabase,
  action: (client: ExplorerPgExecutor) => Promise<T>,
): Promise<T> {
  const client = await database.connect();
  try {
    await client.query("BEGIN");
    try {
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  } finally {
    client.release();
  }
}
export class PostgresCustomerExplorerRepository implements CustomerExplorerRepository {
  constructor(private readonly database: ExplorerPgDatabase) {}
  async createSample(sample: Sample): Promise<void> {
    const scope = scopeValues(sample.scope);
    await transaction(this.database, async (client) => {
      const snapshot = await client.query(
        `INSERT INTO croco_explorer_snapshots (app_id,environment,tenant_id,snapshot_id,digest)
        VALUES ($1,$2,$3,$4,$5) ON CONFLICT (app_id,environment,tenant_id,snapshot_id)
        DO UPDATE SET digest=croco_explorer_snapshots.digest WHERE croco_explorer_snapshots.digest=EXCLUDED.digest RETURNING digest`,
        [...scope, sample.populationSnapshotId, sample.populationDigest],
      );
      if (!snapshot.rows.length) conflict();
      const result = await client.query(
        `INSERT INTO croco_explorer_samples (app_id,environment,tenant_id,id,snapshot_id,expires_at,payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT DO NOTHING RETURNING id`,
        [
          ...scope,
          sample.id,
          sample.populationSnapshotId,
          sample.expiresAt,
          JSON.stringify(sample),
        ],
      );
      if (!result.rows.length) conflict();
    });
  }
  async getSample(scope: ExplorerScope, id: string, now: string): Promise<Sample | undefined> {
    const result = await this.database.query(
      `SELECT payload FROM croco_explorer_samples WHERE ${SCOPE} AND id=$4 AND expires_at>$5`,
      [...scopeValues(scope), id, now],
    );
    return result.rows[0]?.payload as Sample | undefined;
  }
  async deleteSample(scope: ExplorerScope, id: string): Promise<void> {
    await this.database.query(`DELETE FROM croco_explorer_samples WHERE ${SCOPE} AND id=$4`, [
      ...scopeValues(scope),
      id,
    ]);
  }
  async purgeExpired(scope: ExplorerScope, now: string): Promise<number> {
    const result = await this.database.query(
      `DELETE FROM croco_explorer_samples WHERE ${SCOPE} AND expires_at<=$4 RETURNING id`,
      [...scopeValues(scope), now],
    );
    return result.rows.length;
  }
  async listNotes(
    scope: ExplorerScope,
    sampleId: string,
    now: string,
  ): Promise<readonly ExplorerNote[]> {
    const result = await this.database.query(
      `SELECT payload FROM croco_explorer_notes WHERE ${SCOPE} AND sample_id=$4 AND expires_at>$5 AND deleted_at IS NULL ORDER BY id`,
      [...scopeValues(scope), sampleId, now],
    );
    return result.rows.map((row) => row.payload as ExplorerNote);
  }
  async saveNote(note: ExplorerNote, expectedRevision: number): Promise<void> {
    if (
      !Number.isSafeInteger(expectedRevision) ||
      expectedRevision < 0 ||
      note.revision !== expectedRevision + 1
    )
      conflict();
    const scope = scopeValues(note.scope);
    await transaction(this.database, async (client) => {
      const sample = await client.query(
        `SELECT id FROM croco_explorer_samples WHERE ${SCOPE} AND id=$4 AND expires_at>$5 AND expires_at >= $6 FOR SHARE`,
        [...scope, note.sampleId, note.updatedAt, note.expiresAt],
      );
      if (!sample.rows.length)
        throw new CustomerExplorerProblem("not-found", "Sample unavailable or expired");
      const result =
        expectedRevision === 0
          ? await client.query(
              `INSERT INTO croco_explorer_notes (app_id,environment,tenant_id,sample_id,id,revision,expires_at,payload)
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT DO NOTHING RETURNING id`,
              [
                ...scope,
                note.sampleId,
                note.id,
                note.revision,
                note.expiresAt,
                JSON.stringify(note),
              ],
            )
          : await client.query(
              `UPDATE croco_explorer_notes SET revision=$6, expires_at=$7,payload=$8 WHERE ${SCOPE} AND sample_id=$4 AND id=$5 AND revision=$9 AND deleted_at IS NULL RETURNING id`,
              [
                ...scope,
                note.sampleId,
                note.id,
                note.revision,
                note.expiresAt,
                JSON.stringify(note),
                expectedRevision,
              ],
            );
      if (!result.rows.length) conflict();
      await client.query(
        `INSERT INTO croco_explorer_note_audit (app_id,environment,tenant_id,sample_id,note_id,revision,actor,action,at) VALUES ($1,$2,$3,$4,$5,$6,$7,'save',$8)`,
        [...scope, note.sampleId, note.id, note.revision, note.author, note.updatedAt],
      );
    });
  }
  async deleteNote(
    scope: ExplorerScope,
    sampleId: string,
    id: string,
    expectedRevision: number,
    actor: string,
    now: string,
  ): Promise<void> {
    await transaction(this.database, async (client) => {
      const result = await client.query(
        `UPDATE croco_explorer_notes SET deleted_at=$7, revision=revision+1, payload='{}'::jsonb WHERE ${SCOPE} AND sample_id=$4 AND id=$5 AND revision=$6 AND deleted_at IS NULL RETURNING id`,
        [...scopeValues(scope), sampleId, id, expectedRevision, now],
      );
      if (!result.rows.length) conflict();
      await client.query(
        `INSERT INTO croco_explorer_note_audit (app_id,environment,tenant_id,sample_id,note_id,revision,actor,action,at) VALUES ($1,$2,$3,$4,$5,$6,$7,'delete',$8)`,
        [...scopeValues(scope), sampleId, id, expectedRevision + 1, actor, now],
      );
    });
  }
  async listNoteAudit(
    scope: ExplorerScope,
    sampleId: string,
  ): Promise<readonly ExplorerNoteAudit[]> {
    const result = await this.database.query(
      `SELECT note_id,revision,actor,action,at FROM croco_explorer_note_audit WHERE ${SCOPE} AND sample_id=$4 ORDER BY sequence`,
      [...scopeValues(scope), sampleId],
    );
    return result.rows.map((row) => ({
      noteId: String(row.note_id),
      revision: Number(row.revision),
      actor: String(row.actor),
      action: row.action as "save" | "delete",
      at: timestamp(row.at),
    }));
  }
}
export type ExplorerSqlTimelineMapping = Readonly<{
  table: string;
  appId: string;
  environment: string;
  tenantId: string;
  subjectKind: string;
  subjectId: string;
  eventId: string;
  occurredAt: string;
  observedAt: string;
  kind: string;
  safeProperties: string;
}>;
export type PostgresTimelineSourceOptions = Readonly<{
  id: string;
  executor: ExplorerPgExecutor;
  mapping: ExplorerSqlTimelineMapping;
  status(request: TimelineRequest): Promise<ExplorerSourceStatus>;
}>;
function identifier(value: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(value))
    throw new CustomerExplorerProblem("input", "Invalid SQL identifier");
  return `"${value}"`;
}
function timestamp(value: unknown): string {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime()))
    throw new CustomerExplorerProblem("source-failed", "Invalid source timestamp");
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/.test(value)
    ? value
    : date.toISOString();
}
function microseconds(value: string): bigint {
  const milliseconds = Date.parse(value);
  const fraction = value.match(/\.(\d+)(?:Z|[+-]\d{2}:?\d{2})$/)?.[1] ?? "";
  if (!Number.isFinite(milliseconds) || fraction.length > 6)
    throw new CustomerExplorerProblem("input", "Invalid timeline timestamp precision");
  return BigInt(milliseconds) * 1000n + BigInt(fraction.slice(3).padEnd(3, "0"));
}
function validateRequest(request: TimelineRequest): void {
  scopeValues(request.scope);
  if (
    typeof request.subject?.kind !== "string" ||
    !request.subject.kind.trim() ||
    typeof request.subject.id !== "string" ||
    !request.subject.id.trim() ||
    !Number.isInteger(request.limit) ||
    request.limit < 1 ||
    request.limit > 200 ||
    !Number.isFinite(Date.parse(request.from)) ||
    !Number.isFinite(Date.parse(request.to)) ||
    microseconds(request.from) > microseconds(request.to)
  )
    throw new CustomerExplorerProblem("input", "Invalid timeline request");
}
async function checkReferenceAccess(
  status: (request: TimelineRequest) => Promise<ExplorerSourceStatus>,
  scope: ExplorerScope,
  subject: ExplorerSubject,
  eventId: string,
): Promise<void> {
  const request = {
    scope,
    subject,
    from: "0001-01-01T00:00:00.000Z",
    to: "9999-12-31T23:59:59.999Z",
    limit: 1,
  };
  validateRequest(request);
  if (typeof eventId !== "string" || !eventId.trim())
    throw new CustomerExplorerProblem("input", "Event id required");
  const availability = await status(request);
  if (availability === "denied" || availability === "failed")
    throw new CustomerExplorerProblem(
      availability === "denied" ? "denied" : "source-failed",
      "Reference source unavailable",
    );
}
function cursorKey(id: string, request: Omit<TimelineRequest, "limit" | "cursor">): string {
  return JSON.stringify([
    id,
    explorerScopeKey(request.scope),
    request.subject.kind,
    request.subject.id,
    request.from,
    request.to,
  ]);
}
function decodeCursor(cursor: string, key: string): [string, string] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(cursor);
  } catch {
    throw new CustomerExplorerProblem("input", "Invalid timeline cursor");
  }
  if (
    !Array.isArray(parsed) ||
    parsed.length !== 3 ||
    parsed[0] !== key ||
    typeof parsed[1] !== "string" ||
    !Number.isFinite(Date.parse(parsed[1])) ||
    typeof parsed[2] !== "string"
  )
    throw new CustomerExplorerProblem("input", "Cursor does not match source query");
  return [parsed[1], parsed[2]];
}
export class PostgresTimelineSource implements TimelineSource {
  readonly id: string;
  private readonly mapping: ExplorerSqlTimelineMapping;
  constructor(private readonly options: PostgresTimelineSourceOptions) {
    if (!options.id.trim()) throw new CustomerExplorerProblem("input", "Source id required");
    this.id = options.id;
    this.mapping = Object.fromEntries(
      Object.entries(options.mapping).map(([key, value]) => [key, identifier(value)]),
    ) as ExplorerSqlTimelineMapping;
  }
  private predicate(): string {
    const m = this.mapping;
    return `${m.appId}=$1 AND ${m.environment}=$2 AND ${m.tenantId}=$3 AND ${m.subjectKind}=$4 AND ${m.subjectId}=$5`;
  }
  private selection(): string {
    const m = this.mapping;
    return `${m.eventId} AS event_id,to_char(${m.occurredAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at,${m.occurredAt}::text AS cursor_at,to_char(${m.observedAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS observed_at,${m.kind} AS kind,${m.safeProperties} AS properties`;
  }
  private item(
    row: Record<string, unknown>,
    subject: ExplorerSubject,
    completeness: TimelineItem["completeness"],
  ): TimelineItem {
    if (
      typeof row.event_id !== "string" ||
      !row.event_id.trim() ||
      typeof row.kind !== "string" ||
      !row.kind.trim() ||
      typeof row.properties !== "object" ||
      row.properties === null ||
      Array.isArray(row.properties) ||
      Object.values(row.properties).some(
        (value) =>
          value !== null &&
          typeof value !== "string" &&
          typeof value !== "boolean" &&
          !(typeof value === "number" && Number.isFinite(value)),
      )
    )
      throw new CustomerExplorerProblem("source-failed", "Invalid normalized source row");
    return {
      source: this.id,
      eventId: row.event_id,
      occurredAt: timestamp(row.occurred_at),
      observedAt: timestamp(row.observed_at),
      kind: row.kind,
      subject,
      safeProperties: row.properties as TimelineItem["safeProperties"],
      completeness,
    };
  }
  async read(request: TimelineRequest): Promise<TimelineSourcePage> {
    validateRequest(request);
    const key = cursorKey(this.id, request);
    const cursor = request.cursor ? decodeCursor(request.cursor, key) : undefined;
    const status = await this.options.status(request);
    if (status === "denied" || status === "failed") return { items: [], status, truncated: false };
    const m = this.mapping;
    const values: unknown[] = [
      ...scopeValues(request.scope),
      request.subject.kind,
      request.subject.id,
      request.from,
      request.to,
      request.limit + 1,
    ];
    if (cursor) values.push(...cursor);
    const result = await this.options.executor.query(
      `SELECT ${this.selection()} FROM ${m.table} WHERE ${this.predicate()} AND ${m.occurredAt}>=$6 AND ${m.occurredAt}<=$7 ${cursor ? `AND (${m.occurredAt},${m.eventId} COLLATE "C")>($9::timestamptz,$10::text COLLATE "C")` : ""} ORDER BY ${m.occurredAt},${m.eventId} COLLATE "C" LIMIT $8`,
      values,
    );
    const truncated = result.rows.length > request.limit;
    const items = result.rows
      .slice(0, request.limit)
      .map((row) => this.item(row, request.subject, status));
    const last = items.at(-1);
    return {
      items,
      status,
      truncated,
      ...(truncated && last
        ? {
            nextCursor: JSON.stringify([
              key,
              result.rows[request.limit - 1]?.cursor_at,
              last.eventId,
            ]),
          }
        : {}),
    };
  }
  async resolve(
    scope: ExplorerScope,
    subject: ExplorerSubject,
    eventId: string,
  ): Promise<TimelineItem | undefined> {
    await checkReferenceAccess((request) => this.options.status(request), scope, subject, eventId);
    const result = await this.options.executor.query(
      `SELECT ${this.selection()} FROM ${this.mapping.table} WHERE ${this.predicate()} AND ${this.mapping.eventId}=$6 LIMIT 1`,
      [...scopeValues(scope), subject.kind, subject.id, eventId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    const at = timestamp(row.occurred_at);
    const status = await this.options.status({ scope, subject, from: at, to: at, limit: 1 });
    if (status === "denied") throw new CustomerExplorerProblem("denied", "Source access denied");
    if (status === "failed")
      throw new CustomerExplorerProblem("source-failed", "Source unavailable");
    return this.item(row, subject, status);
  }
}
