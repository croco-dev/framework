import type { HttpMethod, ParamType } from './constants';

export interface ControllerMetadata {
  path: string;
  target: Function;
}

export interface RouteMetadata {
  method: HttpMethod;
  path: string;
  methodName: string | symbol;
  statusCode?: number;
}

export interface ParamMetadata {
  type: ParamType;
  index: number;
  name?: string;
  pipes?: PipeTransformConstructor[];
}

export interface HttpContext {
  readonly request: HttpRequestLike;
  readonly response: HttpResponseLike;
  param(name: string): string | undefined;
  query(name: string): string | undefined;
  header(name: string): string | undefined;
  json<T = unknown>(): Promise<T>;
  set(key: string, value: unknown): void;
  get<T = unknown>(key: string): T | undefined;
}

export interface HttpRequestLike {
  method: string;
  url: string;
  headers: Record<string, string>;
  params: Record<string, string>;
  query: Record<string, string>;
}

export interface HttpResponseLike {
  status: number;
  headers: Record<string, string>;
}

export type Constructor<T = unknown> = new (...args: unknown[]) => T;
export type PipeTransformConstructor = Constructor<PipeTransform>;
export type GuardConstructor = Constructor<Guard>;
export type InterceptorConstructor = Constructor<Interceptor>;
export type ExceptionFilterConstructor = Constructor<ExceptionFilter>;

export type PipeTransform = {};
export type Guard = {};
export type Interceptor = {};
export type ExceptionFilter = {};
