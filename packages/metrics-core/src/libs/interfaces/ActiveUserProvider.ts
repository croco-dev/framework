/**
 * Provider interface for computing user-related metrics (DAU, new users, churned users).
 * Implementations: analytics-posthog.ActiveUserProvider
 */
export interface ActiveUserProvider {
  /**
   * Get the number of daily active users for a specific date.
   *
   * An "active" user is defined as a user who has generated at least one event
   * within the last 24 hours from the given date.
   *
   * @param date - The date to query active users for
   * @param tenantId - Optional tenant ID for tenant-specific aggregation. If omitted, returns aggregate across all tenants.
   * @returns The count of active users
   */
  getDailyActiveUsers(date: Date, tenantId?: string): Promise<number>;

  /**
   * Get the number of new users who joined on a specific date.
   *
   * @param date - The date to query new users for
   * @param tenantId - Optional tenant ID for tenant-specific aggregation. If omitted, returns aggregate across all tenants.
   * @returns The count of new users
   */
  getNewUsersCount(date: Date, tenantId?: string): Promise<number>;

  /**
   * Get the number of users who churned on a specific date.
   *
   * A "churned" user is defined as a user who has not generated any events
   * within the defined churn period (e.g., 30 days of inactivity).
   *
   * @param date - The date to query churned users for
   * @param tenantId - Optional tenant ID for tenant-specific aggregation. If omitted, returns aggregate across all tenants.
   * @returns The count of churned users
   */
  getChurnedUsersCount(date: Date, tenantId?: string): Promise<number>;
}
