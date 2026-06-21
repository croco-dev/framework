import type { PolicyExecutionPlan, RequestPipelineGraph } from "@croco/framework-context";
import type { Constructor } from "@croco/protocols-rest";
import type { DevInspectorEndpointOptions } from "./devInspectorEndpoint";
import type { DiagnosticsEndpointOptions } from "./operationalEndpoints";
import type {
  APIGatewayEventRequestContextV2,
  APIGatewayEventRequestContextV2WithAuthorizer,
  APIGatewayProxyEventV2WithRequestContext,
  Context as AwsLambdaContext,
} from "aws-lambda";
import type { Context as HonoContext } from "hono";

export type GuardProvider<T = unknown> = Constructor<T> | T;
export type InterceptorProvider<T = unknown> = Constructor<T> | T;
export type FilterProvider<T = unknown> = Constructor<T> | T;
export type PipeProvider<T = unknown> = Constructor<T> | T;

export interface AppConfig {
  controllers: Constructor[];
  middlewares?: MiddlewareFunction[];
  securityValidation?: "enforce" | "warn" | "off";
  unsafeSkipSecurityValidation?: true;
  diValidation?: "enforce" | "warn" | "off";
  unsafeSkipDiValidation?: true;
  globalFilters?: FilterProvider[];
  globalGuards?: GuardProvider[];
  globalInterceptors?: InterceptorProvider[];
  globalPipes?: PipeProvider[];
  diagnostics?: DiagnosticsEndpointOptions;
  devInspector?: DevInspectorEndpointOptions;
}

export interface ListenOptions {
  staticDir?: string;
  spaFallback?: boolean;
}

export type MiddlewareFunction = (
  ctx: CrocoHttpContext,
  next: () => Promise<Response | void>,
) => Promise<Response | void> | Response | void;

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

export type CompiledRoutePipelineGraphConfig = {
  readonly guards?: readonly unknown[];
  readonly interceptors?: readonly unknown[];
  readonly filters?: readonly unknown[];
  readonly handlerId?: string;
  readonly handlerLabel?: string;
  readonly target?: string;
  readonly policyPlan?: PolicyExecutionPlan;
};

export interface CompiledRoute {
  method: string;
  path: string;
  handler: (ctx: CrocoHttpContext) => Promise<unknown>;
  controllerInstance?: unknown;
  methodName: string | symbol;
  pipelineGraphConfig?: CompiledRoutePipelineGraphConfig;
  pipelineGraph?: RequestPipelineGraph;
}

export type LambdaRequestContext = APIGatewayEventRequestContextV2 & {
  authorizer?: Record<string, unknown>;
};

export type LambdaRequestContextWithAuthorizer<TAuthorizer = Record<string, unknown>> =
  APIGatewayEventRequestContextV2WithAuthorizer<TAuthorizer>;

export type LambdaEvent<
  TRequestContext extends APIGatewayEventRequestContextV2 = LambdaRequestContext,
> = APIGatewayProxyEventV2WithRequestContext<TRequestContext>;

export type LambdaEventWithAuthorizer<TAuthorizer = Record<string, unknown>> = LambdaEvent<
  LambdaRequestContextWithAuthorizer<TAuthorizer>
>;

export type LambdaContext = AwsLambdaContext;

export type LambdaHandler = (event: LambdaEvent, context: LambdaContext) => Promise<LambdaResponse>;

export interface LambdaResponse {
  statusCode: number;
  headers?: Record<string, string>;
  body?: string;
  isBase64Encoded?: boolean;
}
