/**
 * Read-only repository contract for querying entities.
 *
 * @template T - The entity type this repository manages
 * @template ID - The ID type (e.g., string, number, or a custom ID class)
 *
 * @example
 * ```typescript
 * interface User {
 *   id: string;
 *   name: string;
 * }
 *
 * class UserRepository implements ReadRepository<User, string> {
 *   async findById(id: string): Promise<User | null> {
 *     // Fetch from database
 *   }
 *
 *   async findByIds(ids: readonly string[]): Promise<ReadonlyArray<User>> {
 *     // Batch fetch
 *   }
 * }
 * ```
 */
export interface ReadRepository<T, ID> {
  /**
   * Find a single entity by its ID.
   *
   * @param id - The entity ID
   * @returns The entity if found, null otherwise
   */
  findById(id: ID): Promise<T | null>;

  /**
   * Find multiple entities by their IDs.
   *
   * @param ids - Array of entity IDs
   * @returns Array of entities (may be empty or contain nulls)
   */
  findByIds(ids: readonly ID[]): Promise<ReadonlyArray<T>>;
}
