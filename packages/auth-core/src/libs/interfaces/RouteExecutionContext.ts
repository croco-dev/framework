import type { AuthRequest } from './AuthRequest';

export type RouteExecutionContext = {
  getClass(): unknown;
  getHandler(): string | symbol;
  getRequest(): AuthRequest;
};
