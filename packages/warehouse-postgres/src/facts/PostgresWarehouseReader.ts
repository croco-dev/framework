import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

import { WarehouseContractError } from "@croco/warehouse-core";

import { compilePostgresMetric, decodePostgresMetricResult } from "./compilePostgresMetric";

import { defineMetric } from "@croco/metrics-core";
import type { MetricDefinition, MetricEvaluation, MetricWindow } from "@croco/metrics-core";

import { factColumnName, factTableName, quoteIdentifier, scopeKey } from "./schema";

import type { CanonicalRow, FactDescriptor } from "@croco/warehouse-core";
import type {
  WarehouseAccess,
  WarehouseFilter,
  WarehouseOrder,
  WarehousePage,
  WarehouseReadRequest,
  WarehouseReader,
  WarehouseSnapshot,
} from "@croco/warehouse-core/runtime";
import type {
  WarehousePostgresClient,
  WarehousePostgresConnection,
  WarehousePostgresPool,
} from "./client";

type CursorKey = {
  readonly values: readonly (string | boolean)[];
  readonly identity: string;
};

type CursorContext = {
  readonly snapshotId: string;
  readonly queryHash: string;
  readonly scope: string;
  readonly permissionEpoch: number;
  readonly privacyEpoch: number;
};

type LegacyCursor = CursorContext & CursorKey;
type ExtendedCursor = { readonly snapshotId: string; readonly contextHash: string } & CursorKey;

const MAX_PAGE_BYTES = 1_048_576;
const LEGACY_CURSOR_LIMIT = 8192;
const EXTENDED_CURSOR_PREFIX = "v2.";
const EXTENDED_CURSOR_AAD = Buffer.from(EXTENDED_CURSOR_PREFIX);
const CURSOR_NONCE_BYTES = 12;
const CURSOR_TAG_BYTES = 16;
const CURSOR_CRYPTO_BYTES = CURSOR_NONCE_BYTES + CURSOR_TAG_BYTES;
// SQL counts the JSON keys in the server encoding. Allow for conversion to UTF-8
// (up to four bytes per source byte), plus 1 KiB for the compact cursor envelope.
const EXTENDED_CURSOR_LIMIT = encodedCursorLength(MAX_PAGE_BYTES * 4 + 1024);

function encodedCursorLength(jsonBytes: number): number {
  return Math.ceil(((jsonBytes + CURSOR_CRYPTO_BYTES) * 4) / 3);
}

function cursorContextHash(context: Omit<CursorContext, "snapshotId">): string {
  return createHash("sha256")
    .update(
      JSON.stringify([
        context.queryHash,
        context.scope,
        context.permissionEpoch,
        context.privacyEpoch,
      ]),
    )
    .digest("hex");
}

function cursorColumns(order: readonly WarehouseOrder[]): string[] {
  return [...new Set(order.map((item) => item.column))];
}

type SnapshotRow = { readonly data: WarehouseSnapshot; readonly expires_at: Date | string | null };
type HeadRow = { readonly permission_epoch: string; readonly privacy_epoch: string };
type ResultRow = Record<string, unknown> & { readonly _identity: string };
type PageResult = {
  readonly _bytes_exceeded: boolean;
  readonly _has_more: boolean;
  readonly _rows: ResultRow[];
};

const OPERATORS: Record<WarehouseFilter["operator"], string> = {
  eq: "=",
  ne: "<>",
  lt: "<",
  lte: "<=",
  gt: ">",
  gte: ">=",
};

export type PostgresMetricReadRequest = Pick<
  WarehouseReadRequest,
  "access" | "snapshotId" | "maxRows" | "maxBytes" | "timeoutMs" | "signal"
> & {
  readonly definition: MetricDefinition;
  readonly window: MetricWindow;
};

export type PostgresMetricReadResult = {
  readonly data: readonly MetricEvaluation[];
  readonly snapshot: WarehouseSnapshot;
  readonly permissionEpoch: number;
  readonly privacyEpoch: number;
  readonly exactness: "exact";
};

export class PostgresWarehouseReader implements WarehouseReader {
  private activeReads = 0;
  private readonly cursorKey: Buffer;

  constructor(
    private readonly pool: WarehousePostgresPool,
    private readonly descriptor: FactDescriptor,
    private readonly resolveAccess: () => WarehouseAccess,
    cursorSecret: string,
    private readonly cancellationPool: WarehousePostgresPool,
    private readonly maxConcurrent = 8,
  ) {
    if (
      cancellationPool === pool ||
      Buffer.byteLength(cursorSecret) < 32 ||
      !Number.isSafeInteger(maxConcurrent) ||
      maxConcurrent < 1
    )
      throw new WarehouseContractError("WAREHOUSE_READER_CONFIGURATION");
    this.cursorKey = createHash("sha256").update(cursorSecret).digest();
  }

  async read(request: WarehouseReadRequest): Promise<WarehousePage> {
    if (this.activeReads >= this.maxConcurrent)
      throw new WarehouseContractError("WAREHOUSE_READ_CONCURRENCY");
    this.activeReads++;
    try {
      return await this.readLocked(request);
    } finally {
      this.activeReads--;
    }
  }

  async readMetric(request: PostgresMetricReadRequest): Promise<PostgresMetricReadResult> {
    request = {
      ...request,
      definition: defineMetric(request.definition.id, request.definition),
      window: { ...request.window },
    };
    if (this.activeReads >= this.maxConcurrent)
      throw new WarehouseContractError("WAREHOUSE_READ_CONCURRENCY");
    this.activeReads++;
    try {
      const access = structuredClone(this.resolveAccess());
      assertAccess(request.access, access, this.descriptor);
      if (!access.roles.includes("read")) throw new WarehouseContractError("WAREHOUSE_READ_DENIED");
      if (
        !Number.isSafeInteger(request.maxRows) ||
        request.maxRows < 1 ||
        request.maxRows > 1000 ||
        !Number.isSafeInteger(request.maxBytes) ||
        request.maxBytes < 1 ||
        request.maxBytes > 1_048_576 ||
        !Number.isSafeInteger(request.timeoutMs) ||
        request.timeoutMs < 1 ||
        request.timeoutMs > 30_000 ||
        request.signal?.aborted
      )
        throw new WarehouseContractError("WAREHOUSE_READ_LIMIT");
      const compiled = compilePostgresMetric(
        this.descriptor,
        request.definition,
        request.window,
        scopeKey(access.scope),
        0,
        request.maxRows,
        request.maxBytes,
      );
      for (const key of compiled.requiredColumns) {
        if (!access.columns.includes(key))
          throw new WarehouseContractError("WAREHOUSE_COLUMN_DENIED", key);
      }
      return await this.withSnapshot(
        request,
        access,
        async (db, snapshot) => {
          const query = compilePostgresMetric(
            this.descriptor,
            request.definition,
            request.window,
            scopeKey(access.scope),
            snapshot.revision,
            request.maxRows,
            request.maxBytes,
          );
          const result = await db.query(query.sql, query.params);
          const data = decodePostgresMetricResult(request.definition, result.rows[0]);
          if (Buffer.byteLength(JSON.stringify(data)) > request.maxBytes)
            throw new WarehouseContractError("WAREHOUSE_READ_BYTES");
          return {
            data,
            snapshot,
            permissionEpoch: access.permissionEpoch,
            privacyEpoch: access.privacyEpoch,
            exactness: "exact" as const,
          };
        },
        true,
      );
    } finally {
      this.activeReads--;
    }
  }

  private async readLocked(request: WarehouseReadRequest): Promise<WarehousePage> {
    const access = this.resolveAccess();
    assertAccess(request.access, access, this.descriptor);
    if (!access.roles.includes("read")) throw new WarehouseContractError("WAREHOUSE_READ_DENIED");
    if (
      !Number.isSafeInteger(request.maxRows) ||
      request.maxRows < 1 ||
      request.maxRows > 1000 ||
      !Number.isSafeInteger(request.maxBytes) ||
      request.maxBytes < 1 ||
      request.maxBytes > MAX_PAGE_BYTES ||
      !Number.isSafeInteger(request.timeoutMs) ||
      request.timeoutMs < 1 ||
      request.timeoutMs > 30_000 ||
      request.signal?.aborted
    )
      throw new WarehouseContractError("WAREHOUSE_READ_LIMIT");
    if (request.filters.length > 16 || request.order.length > 4)
      throw new WarehouseContractError("WAREHOUSE_READ_LIMIT");
    for (const filter of request.filters) {
      if (
        !Object.hasOwn(OPERATORS, filter.operator) ||
        (filter.value !== null &&
          typeof filter.value !== "string" &&
          typeof filter.value !== "boolean")
      )
        throw new WarehouseContractError("WAREHOUSE_INVALID_FILTER");
      if (typeof filter.value === "string" && Buffer.byteLength(filter.value) > 8192)
        throw new WarehouseContractError("WAREHOUSE_READ_LIMIT");
    }
    const columns = new Set(Object.keys(this.descriptor.columns));
    const allowed = new Set(access.columns);
    const selected = [...new Set(request.projection)];
    if (!selected.length || selected.length !== request.projection.length)
      throw new WarehouseContractError("WAREHOUSE_INVALID_PROJECTION");
    for (const key of [
      ...selected,
      ...request.filters.map((filter) => filter.column),
      ...request.order.map((order) => order.column),
    ]) {
      if (!columns.has(key) || !allowed.has(key))
        throw new WarehouseContractError("WAREHOUSE_COLUMN_DENIED", key);
    }
    if (request.order.some((order) => this.descriptor.columns[order.column].nullable))
      throw new WarehouseContractError("WAREHOUSE_NULLABLE_ORDER");
    const order = request.order.length
      ? request.order
      : this.descriptor.grain.key.map((column) => ({ column, direction: "asc" as const }));
    for (const item of order) {
      if (item.direction !== "asc" && item.direction !== "desc")
        throw new WarehouseContractError("WAREHOUSE_INVALID_ORDER");
      if (!allowed.has(item.column) || this.descriptor.columns[item.column].nullable)
        throw new WarehouseContractError("WAREHOUSE_COLUMN_DENIED", item.column);
    }
    const scope = scopeKey(access.scope);
    const queryHash = createHash("sha256")
      .update(JSON.stringify([selected, request.filters, order]))
      .digest("hex");
    const cursor = request.cursor
      ? this.parseCursor(
          request.cursor,
          {
            snapshotId: request.snapshotId,
            queryHash,
            scope,
            permissionEpoch: access.permissionEpoch,
            privacyEpoch: access.privacyEpoch,
          },
          order,
        )
      : null;

    return this.withSnapshot(request, access, (db, snapshot) =>
      this.fetchPage(db, request, access, snapshot, selected, order, cursor, queryHash, scope),
    );
  }

  private async withSnapshot<T>(
    request: Pick<WarehouseReadRequest, "snapshotId" | "timeoutMs" | "signal">,
    access: WarehouseAccess,
    execute: (db: WarehousePostgresClient, snapshot: WarehouseSnapshot) => Promise<T>,
    readOnly = false,
  ): Promise<T> {
    const scope = scopeKey(access.scope);
    let db: WarehousePostgresConnection | undefined;
    let released = false;
    let finished = false;
    let cancellation: WarehousePostgresConnection | undefined;
    let cancellationFailed = false;
    let backendPid: number | undefined;
    let cancelling: Promise<void> | undefined;
    let stopped: WarehouseContractError | undefined;
    let rejectStopped: (error: WarehouseContractError) => void = () => undefined;
    const interrupted = new Promise<never>((_resolve, reject) => {
      rejectStopped = reject;
    });
    const stop = (code: string): void => {
      if (stopped) return;
      stopped = new WarehouseContractError(code);
      if (db && cancellation && backendPid !== undefined) {
        const target = db;
        const control = cancellation;
        const pid = backendPid;
        cancelling = (async () => {
          let cancelTimer: ReturnType<typeof setTimeout> | undefined;
          try {
            await Promise.race([
              control.query("SELECT pg_cancel_backend($1)", [pid]),
              new Promise<never>((_resolve, reject) => {
                cancelTimer = setTimeout(
                  () => reject(new WarehouseContractError("WAREHOUSE_CANCELLATION_FAILED")),
                  1000,
                );
              }),
            ]);
          } catch {
            cancellationFailed = true;
          } finally {
            if (cancelTimer) clearTimeout(cancelTimer);
            released = true;
            target.release(true);
          }
        })();
      } else if (db && !released) {
        released = true;
        db.release(true);
      }
      rejectStopped(stopped);
    };
    const abortHandler = (): void => stop("WAREHOUSE_READ_CANCELLED");
    const timer = setTimeout(() => stop("WAREHOUSE_READ_TIMEOUT"), request.timeoutMs);
    request.signal?.addEventListener("abort", abortHandler, { once: true });
    const query: WarehousePostgresConnection["query"] = async <T>(
      sql: string,
      params?: unknown[],
    ) => {
      if (stopped) throw stopped;
      if (!db) throw new WarehouseContractError("WAREHOUSE_CONNECTION_UNAVAILABLE");
      return await Promise.race([db.query<T>(sql, params), interrupted]);
    };
    try {
      const acquiring = this.pool.connect().then((connection) => {
        if (stopped || finished) {
          connection.release(true);
          throw stopped ?? new WarehouseContractError("WAREHOUSE_CONNECTION_UNAVAILABLE");
        }
        db = connection;
      });
      const acquiringCancellation = this.cancellationPool.connect().then((connection) => {
        if (stopped || finished) {
          connection.release(true);
          throw stopped ?? new WarehouseContractError("WAREHOUSE_CONNECTION_UNAVAILABLE");
        }
        cancellation = connection;
      });
      if (request.signal?.aborted) abortHandler();
      await Promise.race([Promise.all([acquiring, acquiringCancellation]), interrupted]);
      const backend = await query<{ pid: number }>("SELECT pg_backend_pid() AS pid");
      backendPid = backend.rows[0]?.pid;
      if (!Number.isSafeInteger(backendPid))
        throw new WarehouseContractError("WAREHOUSE_CONNECTION_UNAVAILABLE");
      await query(readOnly ? "BEGIN READ ONLY" : "BEGIN");
      await query("SELECT set_config('statement_timeout',$1,true)", [String(request.timeoutMs)]);
      const head = await query<HeadRow>(
        `SELECT permission_epoch,privacy_epoch FROM warehouse_heads WHERE scope_key=$1 AND model_version=$2${readOnly ? "" : " FOR SHARE"}`,
        [scope, this.descriptor.semanticHash],
      );
      if (
        !head.rows[0] ||
        Number(head.rows[0].permission_epoch) !== access.permissionEpoch ||
        Number(head.rows[0].privacy_epoch) !== access.privacyEpoch
      )
        throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
      const snapshotResult = await query<SnapshotRow>(
        "SELECT data,expires_at FROM warehouse_snapshots WHERE id=$1 AND scope_key=$2 AND model_version=$3",
        [request.snapshotId, scope, this.descriptor.semanticHash],
      );
      const snapshot = snapshotResult.rows[0];
      if (
        !snapshot ||
        (snapshot.expires_at && new Date(snapshot.expires_at).getTime() <= Date.now())
      )
        throw new WarehouseContractError("WAREHOUSE_SNAPSHOT_UNAVAILABLE");
      if (
        snapshot.data.permissionEpoch !== access.permissionEpoch ||
        snapshot.data.privacyEpoch !== access.privacyEpoch
      )
        throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
      const result = await execute({ query }, snapshot.data);
      assertAccess(access, this.resolveAccess(), this.descriptor);
      await query("COMMIT");
      if (readOnly) {
        const current = await query<HeadRow>(
          "SELECT permission_epoch,privacy_epoch FROM warehouse_heads WHERE scope_key=$1 AND model_version=$2",
          [scope, this.descriptor.semanticHash],
        );
        if (
          !current.rows[0] ||
          Number(current.rows[0].permission_epoch) !== access.permissionEpoch ||
          Number(current.rows[0].privacy_epoch) !== access.privacyEpoch
        )
          throw new WarehouseContractError("WAREHOUSE_EPOCH_CHANGED");
        const retained = await query<SnapshotRow>(
          "SELECT data,expires_at FROM warehouse_snapshots WHERE id=$1 AND scope_key=$2 AND model_version=$3",
          [request.snapshotId, scope, this.descriptor.semanticHash],
        );
        if (
          !retained.rows[0] ||
          (retained.rows[0].expires_at &&
            new Date(retained.rows[0].expires_at).getTime() <= Date.now())
        )
          throw new WarehouseContractError("WAREHOUSE_SNAPSHOT_UNAVAILABLE");
      }
      assertAccess(access, this.resolveAccess(), this.descriptor);
      return result;
    } catch (error) {
      if (db && !released && !stopped) {
        try {
          await query("ROLLBACK");
        } catch {
          if (!released) {
            released = true;
            db.release(true);
          }
        }
      }
      await cancelling;
      if (cancellationFailed) throw new WarehouseContractError("WAREHOUSE_CANCELLATION_FAILED");
      throw stopped ?? error;
    } finally {
      finished = true;
      clearTimeout(timer);
      cancellation?.release(cancellationFailed || undefined);
      request.signal?.removeEventListener("abort", abortHandler);
      if (db && !released) {
        released = true;
        db.release();
      }
    }
  }

  private async fetchPage(
    db: WarehousePostgresClient,
    request: WarehouseReadRequest,
    access: WarehouseAccess,
    snapshot: WarehouseSnapshot,
    selected: readonly string[],
    order: readonly WarehouseOrder[],
    cursor: CursorKey | null,
    queryHash: string,
    scope: string,
  ): Promise<WarehousePage> {
    const params: unknown[] = [scope, snapshot.revision, this.descriptor.semanticHash];
    const table = quoteIdentifier(factTableName(this.descriptor));
    const value = (entry: unknown): string => {
      params.push(entry);
      return `$${params.length}`;
    };
    const native = (key: string): string =>
      `f.${quoteIdentifier(factColumnName(this.descriptor, key))}`;
    const fields = [...new Set([...selected, ...order.map((item) => item.column)])];
    const alias = (key: string): string => `v_${fields.indexOf(key)}`;
    const where = [
      "f._scope=$1",
      "f._visible_from IS NOT NULL",
      "f._visible_from<=$2",
      "(f._visible_to IS NULL OR f._visible_to>$2)",
      "NOT EXISTS (SELECT 1 FROM warehouse_suppressions s WHERE s.scope_key=$1 AND s.model_version=$3 AND s.identity=f._identity)",
    ];
    for (const filter of request.filters) {
      const column = native(filter.column);
      if (filter.value === null) {
        if (filter.operator !== "eq" && filter.operator !== "ne")
          throw new WarehouseContractError("WAREHOUSE_INVALID_FILTER");
        where.push(`${column} IS ${filter.operator === "ne" ? "NOT " : ""}NULL`);
      } else {
        where.push(`${column} ${OPERATORS[filter.operator]} ${value(filter.value)}`);
      }
    }
    if (cursor) {
      const bindings = new Map<string, string>();
      const orderedValues = order.map(({ column }, index) => {
        const existing = bindings.get(column);
        if (existing) return existing;
        const param = value(cursor.values[index]);
        bindings.set(column, param);
        return param;
      });
      const branches: string[] = [];
      for (let index = 0; index < order.length; index++) {
        const equals = order
          .slice(0, index)
          .map((item, prior) => `${native(item.column)}=${orderedValues[prior]}`);
        const item = order[index];
        branches.push(
          `(${[...equals, `${native(item.column)} ${item.direction === "asc" ? ">" : "<"} ${orderedValues[index]}`].join(" AND ")})`,
        );
      }
      const finalEquals = order.map(
        (item, index) => `${native(item.column)}=${orderedValues[index]}`,
      );
      branches.push(`(${[...finalEquals, `f._identity>${value(cursor.identity)}`].join(" AND ")})`);
      where.push(`(${branches.join(" OR ")})`);
    }
    const orderSql = [
      ...order.map((item) => `${native(item.column)} ${item.direction.toUpperCase()}`),
      "f._identity ASC",
    ].join(", ");
    const sortProjection = order.map((item, index) => `${native(item.column)} AS s_${index}`);
    const pickedOrder = [
      ...order.map((item, index) => `s_${index} ${item.direction.toUpperCase()}`),
      "_identity ASC",
    ].join(", ");
    const rowLimit = value(request.maxRows);
    const byteLimit = value(request.maxBytes);
    const projectedJson = [
      "'_identity',f._identity",
      ...fields.map((key) => `'${alias(key)}',${this.decodeSql(key, native(key))}`),
    ].join(",");
    const rawBytes = [
      "octet_length(f._identity)::bigint",
      ...fields.map((key) => `COALESCE(octet_length(${this.decodeSql(key, native(key))}::text),4)`),
    ].join("+");
    const result = await db.query<PageResult>(
      `WITH picked AS (
        SELECT f.ctid AS _tid,f._identity,${rawBytes} AS _row_bytes,${sortProjection.join(", ")}
        FROM ${table} f WHERE ${where.join(" AND ")} ORDER BY ${orderSql} LIMIT ${value(request.maxRows + 1)}
      ), numbered AS (
        SELECT *,row_number() OVER (ORDER BY ${pickedOrder}) AS _ordinal FROM picked
      ), bounded AS (
        SELECT *,sum(CASE WHEN _ordinal<=${rowLimit} THEN _row_bytes ELSE 0 END) OVER () AS _raw_bytes FROM numbered
      ), encoded AS (
        SELECT _ordinal,_raw_bytes,CASE WHEN _ordinal<=${rowLimit} AND _raw_bytes<=${byteLimit} THEN jsonb_build_object(${projectedJson}) END AS _row FROM bounded JOIN ${table} f ON f.ctid=bounded._tid
      ), measured AS (
        SELECT *,sum(COALESCE(octet_length(_row::text),0)+CASE WHEN _row IS NULL THEN 0 ELSE 1 END) OVER ()+2 AS _bytes FROM encoded
      )
      SELECT COALESCE(bool_or(_raw_bytes>${byteLimit} OR _bytes>${byteLimit}),false) AS _bytes_exceeded,count(*)>${rowLimit} AS _has_more,
        COALESCE(jsonb_agg(_row ORDER BY _ordinal) FILTER (WHERE _ordinal<=${rowLimit} AND _raw_bytes<=${byteLimit} AND _bytes<=${byteLimit}),'[]'::jsonb) AS _rows
      FROM measured`,
      params,
    );
    const page = result.rows[0];
    if (!page) throw new WarehouseContractError("WAREHOUSE_INVALID_STORED_ROW");
    if (page._bytes_exceeded) throw new WarehouseContractError("WAREHOUSE_READ_BYTES");
    const rows = page._rows;
    const last = rows.at(-1);
    const nextCursor =
      page._has_more && last
        ? this.signCursor(
            {
              snapshotId: snapshot.id,
              queryHash,
              scope,
              permissionEpoch: access.permissionEpoch,
              privacyEpoch: access.privacyEpoch,
              values: order.map((item) => {
                const entry = last[alias(item.column)];
                if (typeof entry !== "string" && typeof entry !== "boolean")
                  throw new WarehouseContractError("WAREHOUSE_CURSOR_VALUE");
                return entry;
              }),
              identity: last._identity,
            },
            order,
          )
        : null;
    return {
      snapshotId: snapshot.id,
      rows: rows.map(
        (row) =>
          Object.fromEntries(
            selected.map((key) => {
              const entry = row[alias(key)];
              if (entry !== null && typeof entry !== "string" && typeof entry !== "boolean")
                throw new WarehouseContractError("WAREHOUSE_INVALID_STORED_ROW", key);
              return [key, entry];
            }),
          ) as CanonicalRow,
      ),
      nextCursor,
      permissionEpoch: access.permissionEpoch,
      privacyEpoch: access.privacyEpoch,
      exactness: "exact",
    };
  }

  private decodeSql(key: string, column: string): string {
    const type = this.descriptor.columns[key];
    if (type.type === "date") return `to_char(${column},'YYYY-MM-DD')`;
    if (type.type === "instant") {
      const format =
        type.precision === "second"
          ? 'YYYY-MM-DD"T"HH24:MI:SS"Z"'
          : type.precision === "millisecond"
            ? 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'
            : 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"';
      return `to_char(${column} AT TIME ZONE 'UTC','${format}')`;
    }
    return type.type === "boolean" ? column : `${column}::text`;
  }

  private signCursor(cursor: LegacyCursor, order: readonly WarehouseOrder[]): string {
    let payload = JSON.stringify(cursor);
    const extended = encodedCursorLength(Buffer.byteLength(payload)) > LEGACY_CURSOR_LIMIT;
    if (extended) {
      const unique = new Map(order.map(({ column }, index) => [column, cursor.values[index]]));
      payload = JSON.stringify({
        snapshotId: cursor.snapshotId,
        contextHash: cursorContextHash(cursor),
        identity: cursor.identity,
        values: [...unique.values()],
      } satisfies ExtendedCursor);
      if (encodedCursorLength(Buffer.byteLength(payload)) > EXTENDED_CURSOR_LIMIT)
        throw new WarehouseContractError("WAREHOUSE_CURSOR_LIMIT");
    }
    const nonce = randomBytes(CURSOR_NONCE_BYTES);
    const cipher = createCipheriv("aes-256-gcm", this.cursorKey, nonce);
    if (extended) cipher.setAAD(EXTENDED_CURSOR_AAD);
    const body = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
    const encoded = Buffer.concat([nonce, cipher.getAuthTag(), body]).toString("base64url");
    return extended ? EXTENDED_CURSOR_PREFIX + encoded : encoded;
  }

  private parseCursor(
    encoded: string,
    context: CursorContext,
    order: readonly WarehouseOrder[],
  ): CursorKey {
    if (typeof encoded !== "string") throw new WarehouseContractError("WAREHOUSE_INVALID_CURSOR");
    const extended = encoded.startsWith(EXTENDED_CURSOR_PREFIX);
    const prefixLength = extended ? EXTENDED_CURSOR_PREFIX.length : 0;
    if (encoded.length - prefixLength > (extended ? EXTENDED_CURSOR_LIMIT : LEGACY_CURSOR_LIMIT))
      throw new WarehouseContractError("WAREHOUSE_INVALID_CURSOR");
    let decoded: unknown;
    try {
      const bytes = Buffer.from(encoded.slice(prefixLength), "base64url");
      if (bytes.length <= CURSOR_CRYPTO_BYTES)
        throw new WarehouseContractError("WAREHOUSE_INVALID_CURSOR");
      const decipher = createDecipheriv(
        "aes-256-gcm",
        this.cursorKey,
        bytes.subarray(0, CURSOR_NONCE_BYTES),
      );
      if (extended) decipher.setAAD(EXTENDED_CURSOR_AAD);
      decipher.setAuthTag(bytes.subarray(CURSOR_NONCE_BYTES, CURSOR_CRYPTO_BYTES));
      decoded = JSON.parse(
        Buffer.concat([
          decipher.update(bytes.subarray(CURSOR_CRYPTO_BYTES)),
          decipher.final(),
        ]).toString("utf8"),
      );
    } catch {
      throw new WarehouseContractError("WAREHOUSE_INVALID_CURSOR");
    }
    if (
      !decoded ||
      typeof decoded !== "object" ||
      !("values" in decoded) ||
      !Array.isArray(decoded.values) ||
      !decoded.values.every(
        (entry: unknown) => typeof entry === "string" || typeof entry === "boolean",
      ) ||
      !("identity" in decoded) ||
      typeof decoded.identity !== "string"
    )
      throw new WarehouseContractError("WAREHOUSE_INVALID_CURSOR");
    const key: CursorKey = { identity: decoded.identity, values: decoded.values };
    if (extended) {
      const columns = cursorColumns(order);
      if (
        !("snapshotId" in decoded) ||
        decoded.snapshotId !== context.snapshotId ||
        !("contextHash" in decoded) ||
        decoded.contextHash !== cursorContextHash(context) ||
        key.values.length !== columns.length
      )
        throw new WarehouseContractError("WAREHOUSE_CURSOR_STALE");
      return {
        identity: key.identity,
        values: order.map(({ column }) => key.values[columns.indexOf(column)]),
      };
    }
    if (
      !("snapshotId" in decoded) ||
      decoded.snapshotId !== context.snapshotId ||
      !("queryHash" in decoded) ||
      decoded.queryHash !== context.queryHash ||
      !("scope" in decoded) ||
      decoded.scope !== context.scope ||
      !("permissionEpoch" in decoded) ||
      decoded.permissionEpoch !== context.permissionEpoch ||
      !("privacyEpoch" in decoded) ||
      decoded.privacyEpoch !== context.privacyEpoch ||
      key.values.length !== order.length
    )
      throw new WarehouseContractError("WAREHOUSE_CURSOR_STALE");
    return key;
  }
}

function assertAccess(
  request: WarehouseAccess,
  current: WarehouseAccess,
  descriptor: FactDescriptor,
): void {
  if (
    JSON.stringify(request) !== JSON.stringify(current) ||
    !current.scope.application ||
    !current.scope.environment ||
    (descriptor.scope === "tenant" ? !current.scope.tenant : current.scope.tenant !== undefined) ||
    !Number.isSafeInteger(current.permissionEpoch) ||
    !Number.isSafeInteger(current.privacyEpoch)
  )
    throw new WarehouseContractError("WAREHOUSE_ACCESS_CHANGED");
}
