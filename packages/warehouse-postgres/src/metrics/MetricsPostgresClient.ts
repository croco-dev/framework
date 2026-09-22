/**
 * Minimal query contract used by the PostgreSQL metrics integration.
 *
 * `pg.Pool`, `pg.Client`, and compatible transaction-scoped clients satisfy this interface.
 */
export interface MetricsPostgresClient {
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
}
