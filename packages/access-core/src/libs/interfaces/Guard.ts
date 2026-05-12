import type { Guard } from "@croco/framework-context";

export type { Guard };

export interface AccessExecutionContext {
  getClass(): object;
  getHandler(): string | symbol;
  getRequest(): Request;
  getHttpContext?(): {
    req: {
      params: Record<string, string>;
    };
    param(name: string): string | undefined;
    get<T>(key: string): T | undefined;
  } | null;
}

export interface AccessHttpContext {
  req: {
    params: Record<string, string>;
  };
  param(name: string): string | undefined;
  get<T>(key: string): T | undefined;
}
