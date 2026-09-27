import {
  canonicalJson,
  canonicalPayloadFromRow,
  canonicalizeColumn,
  encodeIdentityFromRow,
  isRecord,
  validateRow,
} from "./codec";
import { assertContract, WarehouseContractError } from "./diagnostics";
import { assertFact } from "./schema";
import type { CanonicalRow, FactDescriptor, TrustedScope } from "./types";

export type FixtureRunMetadata = {
  readonly executionId?: string;
  readonly sourceId?: string;
  readonly sourceRevision?: string;
};

export type FixtureRow = {
  readonly identity: string;
  readonly row: CanonicalRow;
  readonly metadata: FixtureRunMetadata;
};

type StoredRow = FixtureRow & {
  readonly payload: string;
  readonly scopeKey: string;
};

export type AggregateRange = {
  readonly from: string;
  readonly through: string;
  readonly series: Readonly<Record<string, unknown>>;
};

export class FixtureImporter {
  private readonly rows = new Map<string, StoredRow>();

  constructor(
    private readonly descriptor: FactDescriptor,
    private readonly resolveScope: () => TrustedScope,
    private readonly maxRows = 10_000,
  ) {
    assertFact(descriptor);
    assertContract(
      descriptor.irVersion === 1 &&
        descriptor.compilerVersion === "1" &&
        /^[a-f0-9]{64}$/.test(descriptor.semanticHash),
      "WAREHOUSE_INVALID_DESCRIPTOR",
    );
    assertContract(Number.isSafeInteger(maxRows) && maxRows > 0, "WAREHOUSE_INVALID_FIXTURE_LIMIT");
  }

  importRows(
    input: readonly unknown[],
    metadata: FixtureRunMetadata = {},
  ): { inserted: number; identical: number } {
    assertContract(this.descriptor.write.mode === "append", "WAREHOUSE_IMPORT_MODE");
    assertContract(Array.isArray(input) && input.length <= this.maxRows, "WAREHOUSE_FIXTURE_LIMIT");
    const scope = this.trustedScope();
    const scopeKey = this.scopeKey(scope);
    const runMetadata = this.validateMetadata(metadata);
    const staged = new Map(this.rows);
    let inserted = 0;
    let identical = 0;
    for (const value of input) {
      const row = validateRow(this.descriptor, value);
      const identity = encodeIdentityFromRow(this.descriptor, row, scope);
      const payload = canonicalPayloadFromRow(this.descriptor, row);
      const previous = staged.get(identity);
      if (previous) {
        if (previous.payload !== payload)
          throw new WarehouseContractError("WAREHOUSE_FACT_CONFLICT");
        identical++;
        continue;
      }
      staged.set(identity, { identity, row, payload, scopeKey, metadata: runMetadata });
      inserted++;
    }
    assertContract(staged.size <= this.maxRows, "WAREHOUSE_FIXTURE_LIMIT");
    this.replaceState(staged);
    return { inserted, identical };
  }

  replaceRange(
    range: AggregateRange,
    input: readonly unknown[],
    metadata: FixtureRunMetadata = {},
  ): { inserted: number; removed: number; identical: number } {
    assertContract(
      this.descriptor.write.mode === "replace-range" && this.descriptor.aggregate,
      "WAREHOUSE_IMPORT_MODE",
    );
    assertContract(isRecord(range), "WAREHOUSE_INVALID_RANGE");
    assertContract(Array.isArray(input) && input.length <= this.maxRows, "WAREHOUSE_FIXTURE_LIMIT");
    const aggregate = this.descriptor.aggregate;
    const dateColumn = this.descriptor.columns[aggregate.date];
    const from = canonicalizeColumn(dateColumn, range.from, "range.from");
    const through = canonicalizeColumn(dateColumn, range.through, "range.through");
    assertContract(
      typeof from === "string" && typeof through === "string" && from <= through,
      "WAREHOUSE_INVALID_RANGE",
    );
    assertContract(
      isRecord(range.series) &&
        Object.keys(range.series).length === aggregate.series.length &&
        aggregate.series.every((key) => Object.hasOwn(range.series, key)),
      "WAREHOUSE_INVALID_SERIES",
    );
    const series = aggregate.series.map((key) => {
      const value = canonicalizeColumn(
        this.descriptor.columns[key],
        range.series[key],
        `range.series.${key}`,
      );
      assertContract(value !== null, "WAREHOUSE_INVALID_SERIES");
      return [key, this.descriptor.columns[key].type, value];
    });
    const seriesKey = canonicalJson(series);
    const scope = this.trustedScope();
    const scopeKey = this.scopeKey(scope);
    const runMetadata = this.validateMetadata(metadata);
    const incoming = new Map<string, StoredRow>();
    let identical = 0;
    for (const value of input) {
      const row = validateRow(this.descriptor, value);
      const date = row[aggregate.date];
      assertContract(
        typeof date === "string" && date >= from && date <= through,
        "WAREHOUSE_ROW_OUTSIDE_RANGE",
      );
      const rowSeries = canonicalJson(
        aggregate.series.map((key) => [key, this.descriptor.columns[key].type, row[key]]),
      );
      assertContract(rowSeries === seriesKey, "WAREHOUSE_ROW_OUTSIDE_SERIES");
      const identity = encodeIdentityFromRow(this.descriptor, row, scope);
      const payload = canonicalPayloadFromRow(this.descriptor, row);
      const previous = incoming.get(identity);
      if (previous) {
        if (previous.payload !== payload)
          throw new WarehouseContractError("WAREHOUSE_FACT_CONFLICT");
        identical++;
        continue;
      }
      incoming.set(identity, { identity, row, payload, scopeKey, metadata: runMetadata });
    }
    const staged = new Map(this.rows);
    let removed = 0;
    for (const [identity, stored] of staged) {
      if (stored.scopeKey !== scopeKey) continue;
      const date = stored.row[aggregate.date];
      if (typeof date !== "string" || date < from || date > through) continue;
      const rowSeries = canonicalJson(
        aggregate.series.map((key) => [key, this.descriptor.columns[key].type, stored.row[key]]),
      );
      if (rowSeries !== seriesKey) continue;
      staged.delete(identity);
      removed++;
    }
    for (const [identity, stored] of incoming) staged.set(identity, stored);
    assertContract(staged.size <= this.maxRows, "WAREHOUSE_FIXTURE_LIMIT");
    this.replaceState(staged);
    return { inserted: incoming.size, removed, identical };
  }

  snapshot(): readonly FixtureRow[] {
    const scopeKey = this.scopeKey(this.trustedScope());
    return [...this.rows.values()]
      .filter((stored) => stored.scopeKey === scopeKey)
      .sort((left, right) =>
        left.identity < right.identity ? -1 : left.identity > right.identity ? 1 : 0,
      )
      .map(({ identity, row, metadata }) => ({ identity, row, metadata }));
  }

  private trustedScope(): TrustedScope {
    const scope = this.resolveScope();
    assertContract(
      isRecord(scope) &&
        Object.keys(scope).every((key) => ["application", "environment", "tenant"].includes(key)) &&
        typeof scope.application === "string" &&
        scope.application.length > 0 &&
        typeof scope.environment === "string" &&
        scope.environment.length > 0 &&
        (this.descriptor.scope === "tenant"
          ? typeof scope.tenant === "string" && scope.tenant.length > 0
          : scope.tenant === undefined),
      "WAREHOUSE_INVALID_SCOPE",
    );
    return scope as TrustedScope;
  }

  private scopeKey(scope: TrustedScope): string {
    return canonicalJson([scope.application, scope.environment, scope.tenant ?? null]);
  }

  private validateMetadata(metadata: FixtureRunMetadata): FixtureRunMetadata {
    assertContract(
      isRecord(metadata) &&
        Object.keys(metadata).every((key) =>
          ["executionId", "sourceId", "sourceRevision"].includes(key),
        ),
      "WAREHOUSE_INVALID_METADATA",
    );
    for (const value of Object.values(metadata)) {
      assertContract(typeof value === "string" && value.length > 0, "WAREHOUSE_INVALID_METADATA");
    }
    return Object.freeze({ ...metadata });
  }

  private replaceState(staged: Map<string, StoredRow>): void {
    this.rows.clear();
    for (const [identity, stored] of staged) this.rows.set(identity, stored);
  }
}
