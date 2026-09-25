import { and, eq, getTableColumns, sql } from "drizzle-orm";
import { InvalidUsageValueProblem, MeterRepository } from "@croco/metering-core";
import { ProblemFactory } from "@croco/problems-core";

import type { AnyColumn, SQL, Table } from "drizzle-orm";
import type { ILogger } from "@croco/framework-context";
import type {
  MeterAggregation,
  MeterBillingIntent,
  MeterDefinition,
  MeterRegistrationOptions,
  UsageRecord,
} from "@croco/metering-core";
import type { TxManager } from "@croco/tx-core";
import type { DrizzleInsertCapability, DrizzleSelectCapability } from "@croco/tx-drizzle";

import { InvalidMeterDefinitionProblem } from "./problems/InvalidMeterDefinitionProblem";
import { UsageEnvelopeConfigurationProblem } from "./problems/UsageEnvelopeConfigurationProblem";

const DRIZZLE_JSON_COLUMN_TYPES = new Set([
  "GelJson",
  "MySqlJson",
  "PgJson",
  "PgJsonb",
  "SingleStoreJson",
  "SQLiteBlobJson",
  "SQLiteTextJson",
]);

const METER_BILLING_VALUES = ["local", "required"] as const satisfies readonly MeterBillingIntent[];
const METER_AGGREGATION_VALUES = ["COUNT", "SUM"] as const satisfies readonly MeterAggregation[];

type StoredMeterBillingContract = {
  readonly billing: MeterBillingIntent;
  readonly aggregation: MeterAggregation | null;
  readonly unit: string | null;
};

type DrizzleQueryResult<T> = PromiseLike<T>;

type DrizzleSelectLimitQuery = DrizzleQueryResult<unknown[]>;

type DrizzleSelectWhereQuery = DrizzleQueryResult<unknown[]> & {
  limit(limit: number): DrizzleSelectLimitQuery;
};

type DrizzleSelectFromQuery = DrizzleQueryResult<unknown[]> & {
  where(condition: SQL<unknown> | undefined): DrizzleSelectWhereQuery;
};

type DrizzleSelectQuery = {
  from(table: Table): DrizzleSelectFromQuery;
};

type DrizzleInsertValuesQuery = {
  onConflictDoNothing: (config?: never) => DrizzleQueryResult<unknown>;
  onConflictDoUpdate(config: {
    target: AnyColumn | SQL | (AnyColumn | SQL)[];
    set: Record<string, unknown>;
  }): {
    returning(): DrizzleQueryResult<unknown[]>;
  };
};

type DrizzlePostgresInsertValuesQuery = Omit<DrizzleInsertValuesQuery, "onConflictDoNothing"> & {
  onConflictDoNothing: (config?: {
    target?: AnyColumn | AnyColumn[];
    where?: SQL;
  }) => DrizzleQueryResult<unknown>;
};

type DrizzleInsertQuery = {
  values(values: Record<string, unknown> | Record<string, unknown>[]): DrizzleInsertValuesQuery;
};

type DrizzleMeterQueryClient = DrizzleInsertCapability<(table: Table) => DrizzleInsertQuery> &
  DrizzleSelectCapability<() => DrizzleSelectQuery>;

function isOneOf<const T extends string>(values: readonly T[], value: unknown): value is T {
  return values.some((candidate) => candidate === value);
}

function isPostgresInsertValuesQuery(
  query: DrizzleInsertValuesQuery,
  schema: UsageRecordTable,
): query is DrizzlePostgresInsertValuesQuery {
  return schema.id.columnType.startsWith("Pg");
}

/**
 * 미터 저장소에서 사용하는 최소 Drizzle 데이터베이스 계약입니다.
 */
export type DrizzleMeterDatabase = DrizzleMeterQueryClient;

/**
 * 미터 정의 테이블 컬럼 매핑입니다.
 */
export type MeterTable = {
  id: AnyColumn;
  tenantId: AnyColumn;
  meterId: AnyColumn;
  type: AnyColumn;
  billing: AnyColumn;
  aggregation: AnyColumn;
  unit: AnyColumn;
  quota: AnyColumn;
  allowOverQuota: AnyColumn;
  metadata: AnyColumn;
  createdAt: AnyColumn;
  updatedAt: AnyColumn;
};

/**
 * 사용량 기록 테이블 컬럼 매핑입니다.
 */
export type UsageRecordTable = {
  id: AnyColumn;
  tenantId: AnyColumn;
  meterId: AnyColumn;
  value: AnyColumn;
  recordedAt: AnyColumn;
  metadata: AnyColumn;
  idempotencyKey: AnyColumn;
  eventId?: AnyColumn;
  dimensions?: AnyColumn;
};

/**
 * 저장소 초기화에 필요한 스키마와 직렬화 설정입니다.
 */
export type DrizzleMeterRepositoryConfig = {
  meterTable: Table;
  meterSchema: MeterTable;
  usageRecordTable: Table;
  usageRecordSchema: UsageRecordTable;
  serializeJson?: (value: unknown) => string;
  deserializeJson?: (value: string) => unknown;
};

/**
 * 미터 정의와 사용량 기록을 Drizzle로 저장하는 저장소입니다.
 */
export class DrizzleMeterRepository extends MeterRepository {
  readonly replayContract = "idempotent" as const;

  private readonly meterTable: Table;
  private readonly meterSchema: MeterTable;
  private readonly usageRecordTable: Table;
  private readonly usageRecordSchema: UsageRecordTable;
  private readonly serializeJson: (value: unknown) => string;
  private readonly deserializeJson: (value: string) => unknown;

  /**
   * DB, 트랜잭션 매니저, 스키마 설정을 받아 저장소를 초기화합니다.
   */
  constructor(
    private readonly db: DrizzleMeterDatabase,
    private readonly txManager: TxManager<DrizzleMeterDatabase>,
    config: DrizzleMeterRepositoryConfig,
    private readonly logger?: ILogger,
  ) {
    super();
    this.meterTable = config.meterTable;
    this.meterSchema = config.meterSchema;
    this.usageRecordTable = config.usageRecordTable;
    this.usageRecordSchema = config.usageRecordSchema;
    this.serializeJson = config.serializeJson ?? JSON.stringify;
    this.deserializeJson = config.deserializeJson ?? JSON.parse;
  }

  private getClient(): DrizzleMeterQueryClient {
    return this.txManager.getClient() ?? this.db;
  }

  /**
   * 미터 ID와 테넌트 ID로 미터 정의를 조회합니다.
   */
  async findByMeterIdAndTenant(meterId: string, tenantId: string): Promise<MeterDefinition | null> {
    const client = this.getClient();

    const results = await client
      .select()
      .from(this.meterTable)
      .where(and(eq(this.meterSchema.tenantId, tenantId), eq(this.meterSchema.meterId, meterId)))
      .limit(1);

    if (results.length === 0) {
      return null;
    }

    return this.mapToMeterDefinition(results[0] as Record<string, unknown>);
  }

  /**
   * 미터 정의를 저장하고 저장된 결과를 반환합니다.
   *
   * 같은 `(tenantId, meterId)`가 이미 있으면 새 행을 추가하지 않고 그 행을 이번 등록값 전체로 갱신합니다.
   * 생략한 `quota`, `aggregation`, `unit`, `metadata`는 비워지고 `billing`은 `local`, `allowOverQuota`는 `false`가
   * 되며, `id`와 `createdAt`은 처음 저장한 값을 유지합니다.
   */
  async save(meter: MeterRegistrationOptions): Promise<MeterDefinition> {
    const client = this.getClient();
    const now = new Date();

    this.validateQuota(meter.quota);
    const billingContract = {
      billing: meter.billing === undefined ? "local" : meter.billing,
      aggregation: meter.aggregation ?? null,
      unit: meter.unit ?? null,
    };
    this.assertStoredBillingContract(meter, billingContract);

    const definition = {
      type: meter.type,
      ...billingContract,
      quota: meter.quota ?? null,
      allowOverQuota: meter.allowOverQuota ? 1 : 0,
      metadata: this.encodeJsonColumn(meter.metadata ?? {}, this.meterSchema.metadata),
      updatedAt: this.encodeDateColumn(now, this.meterSchema.updatedAt),
    };

    const [saved] = await client
      .insert(this.meterTable)
      .values({
        tenantId: meter.tenantId,
        meterId: meter.meterId,
        ...definition,
        createdAt: this.encodeDateColumn(now, this.meterSchema.createdAt),
      })
      .onConflictDoUpdate({
        target: [this.meterSchema.tenantId, this.meterSchema.meterId],
        set: definition,
      })
      .returning();

    if (!saved) {
      throw ProblemFactory.internalServerError(
        "meter/insert-failed",
        "Failed to persist meter definition",
      );
    }

    return this.mapToMeterDefinition(saved as Record<string, unknown>);
  }

  /**
   * 모든 미터 정의를 조회합니다.
   */
  async findAll(): Promise<MeterDefinition[]> {
    const client = this.getClient();

    const results = await client.select().from(this.meterTable);

    return (results as Record<string, unknown>[]).map((r) => this.mapToMeterDefinition(r));
  }

  /**
   * 특정 테넌트의 미터 정의를 조회합니다.
   */
  async findByTenant(tenantId: string): Promise<MeterDefinition[]> {
    const client = this.getClient();

    const results = await client
      .select()
      .from(this.meterTable)
      .where(eq(this.meterSchema.tenantId, tenantId));

    return (results as Record<string, unknown>[]).map((r) => this.mapToMeterDefinition(r));
  }

  /**
   * 사용량 기록을 배치로 저장합니다.
   */
  async saveUsageRecords(records: UsageRecord[]): Promise<void> {
    if (records.length === 0) {
      return;
    }

    for (const record of records) {
      if (!Number.isSafeInteger(record.value) || record.value <= 0) {
        throw new InvalidUsageValueProblem(record.value);
      }
    }

    const client = this.getClient();
    const missingMappings = [
      records.some((record) => record.eventId !== undefined) &&
      this.usageRecordSchema.eventId === undefined
        ? "eventId"
        : undefined,
      records.some((record) => record.dimensions !== undefined) &&
      this.usageRecordSchema.dimensions === undefined
        ? "dimensions"
        : undefined,
    ].filter((mapping): mapping is string => mapping !== undefined);
    if (missingMappings.length > 0) {
      throw new UsageEnvelopeConfigurationProblem(missingMappings);
    }

    const columns = getTableColumns(this.usageRecordTable);
    const columnKeys = this.getUsageRecordColumnKeys(columns);
    const values = records.map((record) => {
      const value: Record<string, unknown> = {
        [columnKeys.tenantId]: record.tenantId,
        [columnKeys.meterId]: record.meterId,
        [columnKeys.value]: record.value,
        [columnKeys.recordedAt]: this.encodeDateColumn(
          record.timestamp,
          this.usageRecordSchema.recordedAt,
        ),
        [columnKeys.metadata]: this.encodeJsonColumn(
          record.metadata ?? {},
          this.usageRecordSchema.metadata,
        ),
        [columnKeys.idempotencyKey]: record.idempotencyKey,
      };

      if (this.usageRecordSchema.id.dataType === "string") {
        value[columnKeys.id] = record.id;
      }

      if (columnKeys.eventId) {
        value[columnKeys.eventId] = record.eventId ?? null;
      }
      if (columnKeys.dimensions) {
        value[columnKeys.dimensions] =
          record.dimensions === undefined
            ? null
            : this.encodeJsonColumn(record.dimensions, this.usageRecordSchema.dimensions);
      }

      return value;
    });

    const insertQuery = client.insert(this.usageRecordTable).values(values);

    if (isPostgresInsertValuesQuery(insertQuery, this.usageRecordSchema)) {
      await insertQuery.onConflictDoNothing({
        target: [
          this.usageRecordSchema.tenantId,
          this.usageRecordSchema.meterId,
          this.usageRecordSchema.idempotencyKey,
        ],
        where: sql`${this.usageRecordSchema.idempotencyKey} IS NOT NULL`,
      });
      return;
    }

    await insertQuery.onConflictDoNothing();
  }

  private encodeJsonColumn(value: unknown, column: unknown): unknown {
    return DRIZZLE_JSON_COLUMN_TYPES.has((column as { columnType?: string }).columnType ?? "")
      ? value
      : this.serializeJson(value);
  }

  private encodeDateColumn(value: Date, column: AnyColumn): Date | number {
    return column.dataType === "date" ? value : value.getTime();
  }

  private getUsageRecordColumnKeys(
    columns: Record<string, AnyColumn>,
  ): Partial<Record<keyof UsageRecordTable, string>> &
    Record<
      "id" | "tenantId" | "meterId" | "value" | "recordedAt" | "metadata" | "idempotencyKey",
      string
    > {
    return Object.fromEntries(
      Object.entries(this.usageRecordSchema)
        .filter((entry): entry is [string, AnyColumn] => entry[1] !== undefined)
        .map(([schemaKey, schemaColumn]) => {
          const columnKey =
            Object.entries(columns).find(([, tableColumn]) => tableColumn === schemaColumn)?.[0] ??
            schemaKey;
          return [schemaKey, columnKey];
        }),
    ) as Partial<Record<keyof UsageRecordTable, string>> &
      Record<
        "id" | "tenantId" | "meterId" | "value" | "recordedAt" | "metadata" | "idempotencyKey",
        string
      >;
  }

  private mapToMeterDefinition(raw: Record<string, unknown>): MeterDefinition {
    const quota = raw.quota === null || raw.quota === undefined ? undefined : Number(raw.quota);
    this.validateQuota(quota);
    const tenantId = String(raw.tenantId);
    const meterId = String(raw.meterId);
    const billingContract = { billing: raw.billing, aggregation: raw.aggregation, unit: raw.unit };
    this.assertStoredBillingContract({ tenantId, meterId }, billingContract);

    return {
      id: String(raw.id),
      tenantId,
      meterId,
      type: String(raw.type) as MeterDefinition["type"],
      billing: billingContract.billing,
      aggregation: billingContract.aggregation ?? undefined,
      unit: billingContract.unit ?? undefined,
      quota,
      allowOverQuota: Boolean(raw.allowOverQuota),
      metadata: this.deserializeMetadata(raw.metadata),
      createdAt: this.parseDate(raw.createdAt),
      updatedAt: this.parseDate(raw.updatedAt),
    };
  }

  private assertStoredBillingContract(
    meter: Pick<MeterDefinition, "tenantId" | "meterId">,
    stored: { readonly billing: unknown; readonly aggregation: unknown; readonly unit: unknown },
  ): asserts stored is StoredMeterBillingContract {
    if (!isOneOf(METER_BILLING_VALUES, stored.billing)) {
      throw new InvalidMeterDefinitionProblem(meter, "billing", stored.billing);
    }
    if (stored.aggregation !== null && !isOneOf(METER_AGGREGATION_VALUES, stored.aggregation)) {
      throw new InvalidMeterDefinitionProblem(meter, "aggregation", stored.aggregation);
    }
    if (stored.unit !== null && typeof stored.unit !== "string") {
      throw new InvalidMeterDefinitionProblem(meter, "unit", stored.unit);
    }
  }

  private validateQuota(quota: number | undefined): void {
    if (quota !== undefined && (!Number.isSafeInteger(quota) || quota < 0)) {
      throw new InvalidUsageValueProblem(
        quota,
        "quota must be an integer between 0 and Number.MAX_SAFE_INTEGER",
      );
    }
  }

  private deserializeMetadata(value: unknown): Record<string, unknown> | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    if (typeof value === "string") {
      try {
        const parsed = this.deserializeJson(value) as Record<string, unknown>;
        return Object.keys(parsed).length === 0 ? undefined : parsed;
      } catch (error) {
        this.logger?.warn("Failed to deserialize metadata JSON", { error });
        return undefined;
      }
    }
    if (typeof value === "object" && value !== null) {
      const obj = value as Record<string, unknown>;
      return Object.keys(obj).length === 0 ? undefined : obj;
    }
    return undefined;
  }

  private parseDate(value: unknown): Date {
    if (value instanceof Date) {
      return value;
    }
    if (typeof value === "number") {
      return new Date(value);
    }
    if (typeof value === "string") {
      return new Date(value);
    }
    return new Date();
  }
}
