/**
 * Strategy interface for resolving tenant ID from a request.
 * Implement this interface to support different tenant identification methods.
 *
 * @template TRequest - The type of request object (e.g., HTTP request, context)
 */
export interface TenantResolver<TRequest = unknown> {
  /**
   * Resolve the tenant ID from the given request.
   *
   * @param request - The incoming request object
   * @returns The tenant ID if found, null otherwise
   */
  resolve(request: TRequest): Promise<string | null>;
}
