/** A repository result explicitly associated with the requested ID that produced it. */
export type KeyedRepositoryResult<ID, T> = {
  /** The requested ID that produced this result. */
  readonly key: ID;

  /** The entity resolved for the key. */
  readonly value: T;
};

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
 *   async findByIds(ids: readonly string[]): Promise<ReadonlyArray<KeyedRepositoryResult<string, User>>> {
 *     const users = await this.fetchUsers(ids);
 *     return users.map((user) => ({ key: user.id, value: user }));
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
   * @returns Keyed results for found entities. Missing IDs are omitted, entries may be returned in
   * any order, and every requested ID may appear at most once.
   */
  findByIds(ids: readonly ID[]): Promise<ReadonlyArray<KeyedRepositoryResult<ID, T>>>;
}
