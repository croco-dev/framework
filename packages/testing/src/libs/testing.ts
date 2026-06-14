import "reflect-metadata";
import { Container, LOGGER_TOKEN, type ILogger, type Token } from "@croco/framework-context";
import { Logger } from "@croco/framework-logger";
import { emitOpenAPI, type EmitOpenAPIOptions } from "@croco/openapi-spec";
import type { ProblemDetails } from "@croco/problems-core";
import {
  createApp,
  type AppConfig,
  type CrocoApp,
  ErrorHandler,
  HealthCheckRegistry,
} from "@croco/transports-http";

type PrimitiveQueryValue = string | number | boolean | null | undefined;
type QueryValue = PrimitiveQueryValue | readonly PrimitiveQueryValue[];
type HttpMethod = "get" | "post" | "put" | "delete" | "patch" | "head" | "options" | "trace";
type OpenAPIOperation = {
  readonly operationId?: string;
  readonly responses?: Record<string, OpenAPIResponse>;
};
type OpenAPIResponse = {
  readonly content?: Record<string, unknown>;
};
type OpenAPIDocumentLike = {
  readonly paths?: Record<string, Partial<Record<HttpMethod, OpenAPIOperation>>>;
};
type TestingConstructor<T = unknown> = new (...args: never[]) => T;
type TestingToken<T = unknown> = TestingConstructor<T> | Token<T> | string | symbol;

export type TestLogger = ILogger;

export type TestingProvider<T = unknown> =
  | TestingConstructor<T>
  | {
      readonly token: TestingToken<T>;
      readonly useValue: T;
    }
  | {
      readonly token: TestingToken<T>;
      readonly useFactory: () => T;
    };

export type TestingHarnessOptions = {
  readonly baseUrl?: string;
};

export type TestingAppOptions = Omit<AppConfig, "controllers"> &
  TestingHarnessOptions & {
    readonly autoRegisterControllers?: boolean;
    readonly controllers: readonly TestingConstructor[];
    readonly logger?: TestLogger;
    readonly providers?: readonly TestingProvider[];
    readonly resetContainer?: boolean;
  };

export type TestingRequestOptions = Omit<RequestInit, "body"> & {
  readonly body?: BodyInit | null;
  readonly json?: unknown;
  readonly query?: Record<string, QueryValue>;
};

export type ProblemResponseExpectation = {
  readonly code?: string;
  readonly detailIncludes?: string | readonly string[];
  readonly instance?: string;
  readonly status?: number;
  readonly title?: string;
  readonly type?: string;
};

export type OpenAPIRouteExpectation = {
  readonly contentType?: string;
  readonly method: HttpMethod | Uppercase<HttpMethod>;
  readonly operationId?: string;
  readonly path: string;
  readonly status?: number | `${number}` | "default";
};

const DEFAULT_BASE_URL = "http://localhost";
const IGNORED_PARAM_TYPES = new Set<unknown>([Object, String, Number, Boolean, Array]);

class SilentTestLogger implements TestLogger {
  debug(): void {}

  info(): void {}

  warn(): void {}

  error(): void {}

  child(): TestLogger {
    return this;
  }
}

export class CrocoTestingApp {
  constructor(
    readonly app: CrocoApp,
    readonly baseUrl: string = DEFAULT_BASE_URL,
  ) {}

  request(path: string | URL | Request, options: TestingRequestOptions = {}): Promise<Response> {
    return this.app.fetch(toRequest(path, options, this.baseUrl));
  }

  get(path: string | URL, options: Omit<TestingRequestOptions, "method"> = {}): Promise<Response> {
    return this.request(path, { ...options, method: "GET" });
  }

  post(path: string | URL, options: Omit<TestingRequestOptions, "method"> = {}): Promise<Response> {
    return this.request(path, { ...options, method: "POST" });
  }

  put(path: string | URL, options: Omit<TestingRequestOptions, "method"> = {}): Promise<Response> {
    return this.request(path, { ...options, method: "PUT" });
  }

  patch(
    path: string | URL,
    options: Omit<TestingRequestOptions, "method"> = {},
  ): Promise<Response> {
    return this.request(path, { ...options, method: "PATCH" });
  }

  delete(
    path: string | URL,
    options: Omit<TestingRequestOptions, "method"> = {},
  ): Promise<Response> {
    return this.request(path, { ...options, method: "DELETE" });
  }

  readJson<T = unknown>(response: Response): Promise<T> {
    return readResponseJson<T>(response);
  }

  readProblem(response: Response): Promise<ProblemDetails> {
    return readProblemResponse(response);
  }

  assertProblem(
    response: Response,
    expected: ProblemResponseExpectation = {},
  ): Promise<ProblemDetails> {
    return assertProblemResponse(response, expected);
  }

  rpcFetch(): typeof fetch {
    return createRpcTestFetch(this.app, { baseUrl: this.baseUrl });
  }
}

export function createTestingApp(options: TestingAppOptions): CrocoTestingApp {
  const {
    autoRegisterControllers = true,
    baseUrl = DEFAULT_BASE_URL,
    logger,
    providers = [],
    resetContainer = true,
    ...appConfig
  } = options;

  if (resetContainer) {
    resetCrocoTestingContext({ logger, providers });
  } else {
    seedCrocoTestingDefaults(logger);
    registerTestingProviders(providers);
  }

  if (autoRegisterControllers) {
    registerConstructors(appConfig.controllers);
  }

  return createTestingHarness(
    createApp({
      ...appConfig,
      controllers: appConfig.controllers as AppConfig["controllers"],
      securityValidation: appConfig.securityValidation ?? "off",
    }),
    { baseUrl },
  );
}

export function createTestingHarness(
  app: CrocoApp,
  options: TestingHarnessOptions = {},
): CrocoTestingApp {
  return new CrocoTestingApp(app, options.baseUrl ?? DEFAULT_BASE_URL);
}

export function resetCrocoTestingContext(
  options: {
    readonly logger?: TestLogger;
    readonly providers?: readonly TestingProvider[];
  } = {},
): void {
  Container.reset();
  seedCrocoTestingDefaults(options.logger);
  registerTestingProviders(options.providers ?? []);
}

export async function readResponseJson<T = unknown>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

export async function readProblemResponse(response: Response): Promise<ProblemDetails> {
  const body = await readResponseJson<unknown>(response);

  if (!isProblemDetails(body)) {
    throw new Error("Expected response body to be RFC 7807 Problem Details.");
  }

  return body;
}

export async function assertProblemResponse(
  response: Response,
  expected: ProblemResponseExpectation = {},
): Promise<ProblemDetails> {
  if (expected.status !== undefined && response.status !== expected.status) {
    throw new Error(`Expected HTTP status ${expected.status}, received ${response.status}.`);
  }

  const problem = await readProblemResponse(response);
  assertEqual(problem.status, expected.status, "Problem status");
  assertEqual(problem.code, expected.code, "Problem code");
  assertEqual(problem.title, expected.title, "Problem title");
  assertEqual(problem.type, expected.type, "Problem type");
  assertEqual(problem.instance, expected.instance, "Problem instance");

  const detailIncludes = toArray(expected.detailIncludes);
  for (const expectedDetail of detailIncludes) {
    if (!problem.detail?.includes(expectedDetail)) {
      throw new Error(`Expected Problem detail to include "${expectedDetail}".`);
    }
  }

  return problem;
}

export function assertOpenAPIRoute(
  controllersOrDocument: readonly TestingConstructor[] | OpenAPIDocumentLike,
  expected: OpenAPIRouteExpectation,
  options: EmitOpenAPIOptions = {},
): OpenAPIOperation {
  const document = (
    Array.isArray(controllersOrDocument)
      ? emitOpenAPI(controllersOrDocument as Parameters<typeof emitOpenAPI>[0], options)
      : controllersOrDocument
  ) as OpenAPIDocumentLike;
  const path = normalizeOpenAPIPath(expected.path);
  const method = expected.method.toLowerCase() as HttpMethod;
  const operation = document.paths?.[path]?.[method];

  if (!operation) {
    throw new Error(`Expected OpenAPI operation ${method.toUpperCase()} ${path}.`);
  }

  assertEqual(operation.operationId, expected.operationId, "OpenAPI operationId");

  if (expected.status !== undefined) {
    const response = operation.responses?.[String(expected.status)];
    if (!response) {
      throw new Error(
        `Expected OpenAPI operation ${method.toUpperCase()} ${path} to document ${expected.status}.`,
      );
    }

    if (expected.contentType !== undefined && !response.content?.[expected.contentType]) {
      throw new Error(
        `Expected OpenAPI ${expected.status} response to document ${expected.contentType}.`,
      );
    }
  }

  return operation;
}

export function createRpcTestFetch(
  app: CrocoApp | CrocoTestingApp,
  options: TestingHarnessOptions = {},
): typeof fetch {
  const targetApp = app instanceof CrocoTestingApp ? app.app : app;
  const baseUrl =
    options.baseUrl ?? (app instanceof CrocoTestingApp ? app.baseUrl : DEFAULT_BASE_URL);

  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const request =
      input instanceof Request
        ? toRequest(input, init ?? {}, baseUrl)
        : toRequest(String(input), init ?? {}, baseUrl);

    return targetApp.fetch(request);
  };
}

function seedCrocoTestingDefaults(logger: TestLogger = new SilentTestLogger()): void {
  Container.set(LOGGER_TOKEN, logger);
  Container.set(Logger, logger as Logger);
  Container.set(ErrorHandler, new ErrorHandler(logger as Logger));
  Container.set(HealthCheckRegistry, new HealthCheckRegistry());
}

function registerTestingProviders(providers: readonly TestingProvider[]): void {
  for (const provider of providers) {
    if (typeof provider === "function") {
      registerConstructors([provider]);
      continue;
    }

    if ("useValue" in provider) {
      Container.set(provider.token, provider.useValue);
      continue;
    }

    Container.set(provider.token, provider.useFactory());
  }
}

function registerConstructors(constructors: readonly TestingConstructor[]): void {
  const constructing = new Set<TestingConstructor>();

  for (const constructor of constructors) {
    registerConstructor(constructor, constructing);
  }
}

function registerConstructor<T>(
  constructor: TestingConstructor<T>,
  constructing: Set<TestingConstructor>,
): T {
  if (Container.has(constructor)) {
    return Container.get(constructor);
  }

  if (constructing.has(constructor)) {
    throw new Error(
      `Circular testing provider dependency detected for ${getConstructorName(constructor)}.`,
    );
  }

  constructing.add(constructor);
  const paramTypes = getConstructorParamTypes(constructor);
  const dependencies = paramTypes.map((dependency) =>
    registerConstructor(dependency, constructing),
  );
  const instance = Reflect.construct(constructor, dependencies) as T;
  Container.set(constructor, instance);
  constructing.delete(constructor);

  return instance;
}

function getConstructorName(constructor: TestingConstructor): string {
  return (constructor as { readonly name?: string }).name ?? "anonymous";
}

function getConstructorParamTypes<T>(constructor: TestingConstructor<T>): TestingConstructor[] {
  const paramTypes = Reflect.getMetadata("design:paramtypes", constructor) as unknown;

  if (!Array.isArray(paramTypes)) {
    return [];
  }

  return paramTypes.filter(
    (value): value is TestingConstructor =>
      typeof value === "function" && !IGNORED_PARAM_TYPES.has(value),
  );
}

function toRequest(
  input: string | URL | Request,
  options: TestingRequestOptions | RequestInit,
  baseUrl: string,
): Request {
  if (input instanceof Request) {
    const url = toAbsoluteUrl(input.url, baseUrl);
    const request = new Request(url.toString(), input);
    return new Request(request, options);
  }

  const url = toAbsoluteUrl(String(input), baseUrl);
  appendQuery(url, "query" in options ? options.query : undefined);
  const headers = new Headers(options.headers);
  const body =
    "json" in options && options.json !== undefined
      ? JSON.stringify(options.json)
      : "body" in options
        ? options.body
        : undefined;

  if ("json" in options && options.json !== undefined && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }

  return new Request(url.toString(), {
    ...options,
    body,
    headers,
  });
}

function toAbsoluteUrl(input: string, baseUrl: string): URL {
  return new URL(input, baseUrl);
}

function appendQuery(url: URL, query: Record<string, QueryValue> | undefined): void {
  if (!query) {
    return;
  }

  for (const [key, value] of Object.entries(query)) {
    for (const item of toArray(value)) {
      if (item === null || item === undefined) {
        continue;
      }

      url.searchParams.append(key, String(item));
    }
  }
}

function isProblemDetails(value: unknown): value is ProblemDetails {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.status === "number" &&
    typeof value.code === "string" &&
    (value.detail === undefined || typeof value.detail === "string") &&
    (value.instance === undefined || typeof value.instance === "string")
  );
}

function normalizeOpenAPIPath(path: string): string {
  return path.replace(/:([^/]+)/g, "{$1}");
}

function assertEqual<T>(actual: T, expected: T | undefined, label: string): void {
  if (expected !== undefined && actual !== expected) {
    throw new Error(`${label} expected ${String(expected)}, received ${String(actual)}.`);
  }
}

function toArray<T>(value: T | readonly T[] | undefined): T[] {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? ([...value] as T[]) : [value as T];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
