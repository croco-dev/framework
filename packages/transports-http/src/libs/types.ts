import type { Constructor } from '@croco/protocols-rest';
import type { Context as HonoContext } from 'hono';

export interface AppConfig {
  controllers: Constructor[];
  middlewares?: MiddlewareFunction[];
  globalFilters?: Constructor[];
  globalGuards?: Constructor[];
  globalInterceptors?: Constructor[];
  globalPipes?: Constructor[];
}

export type MiddlewareFunction = (ctx: CrocoHttpContext, next: () => Promise<void>) => Promise<void> | void;

export interface CrocoHttpContext {
  readonly req: CrocoRequest;
  readonly res: CrocoResponse;
  readonly raw: HonoContext;
  param(name: string): string | undefined;
  query(name: string): string | undefined;
  header(name: string): string | undefined;
  json<T = unknown>(): Promise<T>;
  set<T>(key: string, value: T): void;
  get<T>(key: string): T | undefined;
  text(body: string, status?: number): Response;
  jsonResponse<T>(body: T, status?: number): Response;
  redirect(url: string, status?: number): Response;
}

export interface CrocoRequest {
  method: string;
  url: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  headers: Record<string, string>;
}

export interface CrocoResponse {
  status: number;
  headers: Record<string, string>;
}

export interface CompiledRoute {
  method: string;
  path: string;
  handler: (ctx: CrocoHttpContext) => Promise<unknown>;
  controllerInstance?: unknown;
  methodName: string | symbol;
}

export interface LambdaEvent {
  requestContext?: {
    http?: { method: string; path: string };
  };
  rawPath?: string;
  rawQueryString?: string;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}

export interface LambdaContext {
  functionName: string;
  awsRequestId: string;
  getRemainingTimeInMillis(): number;
}

export type LambdaHandler = (event: LambdaEvent, context: LambdaContext) => Promise<LambdaResponse>;

export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}
