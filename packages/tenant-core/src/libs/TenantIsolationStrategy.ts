/**
 * Isolation strategy type
 */
export type TenantIsolationType = 'schema-per-tenant' | 'row-level' | 'hybrid';

/**
 * ORM-neutral filter representation for tenant isolation.
 * Concrete implementations (e.g., Drizzle) will convert this to SQL.
 */
export type TenantIsolationFilter = {
  type: 'sql';
  condition: string;
  params?: unknown[];
};

/**
 * Isolation strategy configuration
 */
export type TenantIsolationConfig =
  | {
      type: 'schema-per-tenant';
      getSchemaName: (tenantId: string) => string;
    }
  | {
      type: 'row-level';
      columnName: string;
      sqlBuilder: (tenantId: string) => TenantIsolationFilter;
    }
  | {
      type: 'hybrid';
      default: 'schema-per-tenant' | 'row-level';
      getSchemaName: (tenantId: string) => string;
      columnName: string;
      sqlBuilder: (tenantId: string) => TenantIsolationFilter;
      useRowLevelForTenants?: string[];
    };

/**
 * Interface for tenant data isolation strategies.
 * Implementations provide different isolation approaches for multi-tenant data.
 */
export interface TenantIsolationStrategy {
  /**
   * Get the isolation type
   * @returns The isolation strategy type
   */
  getType(): TenantIsolationType;

  /**
   * Get the schema name for a tenant (for schema-per-tenant strategy)
   * @param tenantId - Tenant ID
   * @returns Schema name or null if not applicable
   */
  getSchemaName(tenantId: string): string | null;

  /**
   * Build SQL filter for tenant isolation (for row-level strategy)
   * @param tenantId - Tenant ID
   * @returns SQL condition or null if not applicable
   */
  buildFilter(tenantId: string): TenantIsolationFilter | null;

  /**
   * Check if the strategy supports the given isolation type
   * @param type - Isolation type to check
   * @returns True if supported
   */
  supports(type: TenantIsolationType): boolean;

  /**
   * Get the column name for row-level filtering
   * @returns Column name or null if not applicable
   */
  getRowLevelColumnName(): string | null;
}
