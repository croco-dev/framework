import type { CreateExecutionParams, Execution, ListExecutionsOptions } from "../types";

/**
 * ExecutionStore defines the storage abstraction for execution records.
 *
 * Implementations (e.g., DrizzleExecutionStore) handle persistence
 * while ExecutionManager uses this abstract class for CRUD operations.
 */
export abstract class ExecutionStore {
  /**
   * Create a new execution record.
   *
   * If idempotencyKey is provided and an existing execution with the same key exists,
   * implementations should return the existing execution instead of creating a new one.
   *
   * @throws Error if creation fails (excluding idempotency conflicts)
   */
  abstract create(params: CreateExecutionParams): Promise<Execution>;

  /**
   * Find an execution by its ID.
   *
   * @returns Execution or null if not found
   */
  abstract findById(id: string): Promise<Execution | null>;

  /**
   * Find an execution by idempotency key.
   *
   * Used for idempotency check during creation.
   *
   * @returns Execution or null if not found
   */
  abstract findByIdempotencyKey(key: string): Promise<Execution | null>;

  /**
   * Update an execution record.
   *
   * Only updates fields provided in the data parameter.
   * Should preserve all existing fields not specified in data.
   *
   * @returns Updated execution
   * @throws Error if execution not found or update fails
   */
  abstract update(id: string, data: Partial<Execution>): Promise<Execution>;

  /**
   * List executions with optional filtering.
   *
   * @returns Array of executions matching the criteria
   */
  abstract list(options?: ListExecutionsOptions): Promise<Execution[]>;

  /**
   * Delete an execution record.
   *
   * @throws Error if execution not found or deletion fails
   */
  abstract delete(id: string): Promise<void>;
}
