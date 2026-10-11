export interface WarehousePostgresClient {
  query<T = Record<string, unknown>>(
    sql: string,
    params?: unknown[],
  ): Promise<{ rows: T[]; rowCount?: number | null }>;
}

export interface WarehousePostgresConnection extends WarehousePostgresClient {
  /** Passing true must destroy the transport and prevent connection reuse, as pg.Pool does. */
  release(error?: Error | boolean): void;
}

export interface WarehousePostgresPool extends WarehousePostgresClient {
  connect(): Promise<WarehousePostgresConnection>;
}
