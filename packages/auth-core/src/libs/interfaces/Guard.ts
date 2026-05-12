import type { Guard } from "@croco/framework-context";
import type { AuthRequest } from "./AuthRequest";

export type { Guard };

export interface RouteExecutionContext {
  getClass(): object;
  getHandler(): string | symbol;
  getRequest(): AuthRequest;
}
