/**
 * Tenant status
 */
export type TenantStatus = "active" | "inactive" | "suspended" | "trial" | "expired";

/**
 * Tenant entity
 */
export type Tenant = {
  id: string;
  slug: string;
  name: string;
  status: TenantStatus;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
};

/**
 * Tenant settings
 */
export type TenantSettings = {
  timezone?: string;
  locale?: string;
  theme?: string;
  features?: string[];
  limits?: Record<string, number>;
  metadata?: Record<string, unknown>;
};

/**
 * Tenant search/filter options
 */
export type TenantFilter = {
  status?: TenantStatus;
  slug?: string;
  search?: string;
};

/**
 * Interface for tenant storage operations.
 * Implementations provide CRUD operations and settings management for tenants.
 */
export interface TenantStore {
  /**
   * Find a tenant by ID
   * @param id - Tenant ID
   * @returns The tenant if found, null otherwise
   */
  findById(id: string): Promise<Tenant | null>;

  /**
   * Find a tenant by slug
   * @param slug - Tenant slug/identifier
   * @returns The tenant if found, null otherwise
   */
  findBySlug(slug: string): Promise<Tenant | null>;

  /**
   * Find all tenants matching the filter
   * @param filter - Filter criteria
   * @returns Array of matching tenants
   */
  findAll(filter?: TenantFilter): Promise<Tenant[]>;

  /**
   * Create a new tenant
   * @param data - Tenant data
   * @returns The created tenant
   */
  create(data: Omit<Tenant, "id" | "createdAt" | "updatedAt">): Promise<Tenant>;

  /**
   * Update an existing tenant
   * @param id - Tenant ID
   * @param data - Partial tenant data to update
   * @returns The updated tenant
   */
  update(
    id: string,
    data: Partial<Omit<Tenant, "id" | "createdAt" | "updatedAt">>,
  ): Promise<Tenant>;

  /**
   * Delete a tenant by ID
   * @param id - Tenant ID
   * @returns True if deleted, false if not found
   */
  delete(id: string): Promise<boolean>;

  /**
   * Update tenant settings
   * @param id - Tenant ID
   * @param settings - Partial settings to update
   * @returns The updated tenant
   */
  updateSettings(id: string, settings: Partial<TenantSettings>): Promise<Tenant>;

  /**
   * Check if a tenant exists by ID
   * @param id - Tenant ID
   * @returns True if exists, false otherwise
   */
  exists(id: string): Promise<boolean>;
}
