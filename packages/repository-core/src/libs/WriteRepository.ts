/**
 * Write-only repository contract for persisting and deleting entities.
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
 * class UserRepository implements WriteRepository<User, string> {
 *   async save(entity: User): Promise<User> {
 *     // Insert or update
 *   }
 *
 *   async deleteById(id: string): Promise<void> {
 *     // Delete from database
 *   }
 * }
 * ```
 */
export interface WriteRepository<T, ID> {
  /**
   * Save an entity (insert or update).
   *
   * @param entity - The entity to save
   * @returns The saved entity (possibly with generated fields like ID)
   */
  save(entity: T): Promise<T>;

  /**
   * Delete an entity by its ID.
   *
   * @param id - The ID of the entity to delete
   */
  deleteById(id: ID): Promise<void>;
}
