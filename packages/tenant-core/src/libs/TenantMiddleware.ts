import type { Context } from "@croco/framework-context";
import type { TenantGuard } from "./guards/TenantGuard";

export type MiddlewareRequest = {
  headers?: Record<string, string | string[] | undefined>;
  url?: string;
};

export type TenantMiddlewareContext = {
  tenantId: string;
  request: MiddlewareRequest;
};

export type TenantMiddlewareResult = {
  tenantId: string;
  context: Context;
};

export interface TenantMiddleware {
  /**
   * Execute the middleware
   * @param request - The incoming request
   * @param guards - Tenant guards to apply
   * @returns The resolved tenant context
   */
  execute(request: MiddlewareRequest, guards?: TenantGuard[]): Promise<TenantMiddlewareResult>;

  /**
   * Check if the middleware can handle the request
   * @param request - The incoming request
   * @returns True if the middleware can handle the request
   */
  canHandle(request: MiddlewareRequest): boolean;
}
