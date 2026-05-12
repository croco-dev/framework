import type { ReadRepository } from "./ReadRepository";
import type { WriteRepository } from "./WriteRepository";

/**
 * Unified repository contract that combines read and write capabilities.
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
 * class UserRepository implements Repository<User, string> {
 *   // Read operations
 *   async findById(id: string): Promise<User | null> { /-* ... *-/ }
 *   async findByIds(ids: readonly string[]): Promise<ReadonlyArray<User>> { /-* ... *-/ }
 *
 *   // Write operations
 *   async save(entity: User): Promise<User> { /-* ... *-/ }
 *   async deleteById(id: string): Promise<void> { /-* ... *-/ }
 * }
 * ```
 */
export interface Repository<T, ID> extends ReadRepository<T, ID>, WriteRepository<T, ID> {}
