import type { z } from "zod";
import type { HttpMethod } from "../constants";

export type RouteHandler<
  Req extends Record<string, unknown> = Record<string, unknown>,
  Res = unknown,
> = (request: Req) => Res | Promise<Res>;

export type RouteInputSchemas = {
  body: z.ZodType | null;
  path: z.ZodType | null;
  query: z.ZodType | null;
};

export type TypedRouteConfig<
  Body extends z.ZodType | undefined = undefined,
  Query extends z.ZodType | undefined = undefined,
  Params extends z.ZodType | undefined = undefined,
  Response extends z.ZodType | undefined = undefined,
> = {
  method: HttpMethod;
  path: string;
  body?: Body;
  query?: Query;
  params?: Params;
  inputSchemas?: RouteInputSchemas;
  response?: Response;
};

export type InferRouteRequest<T extends TypedRouteConfig> = {
  body: T["body"] extends z.ZodType ? z.infer<T["body"]> : unknown;
  query: T["query"] extends z.ZodType ? z.infer<T["query"]> : unknown;
  params: T["params"] extends z.ZodType ? z.infer<T["params"]> : unknown;
};

export type InferRouteResponse<T extends TypedRouteConfig> = T["response"] extends z.ZodType
  ? z.infer<T["response"]>
  : unknown;

export type TypedRouteHandler<T extends TypedRouteConfig> = (
  request: InferRouteRequest<T>,
) => InferRouteResponse<T> | Promise<InferRouteResponse<T>>;

export type ApiEndpoint<
  Method extends HttpMethod = HttpMethod,
  Path extends string = string,
  Body extends z.ZodType | undefined = undefined,
  Query extends z.ZodType | undefined = undefined,
  Params extends z.ZodType | undefined = undefined,
  Response extends z.ZodType | undefined = undefined,
> = {
  method: Method;
  path: Path;
  body?: Body;
  query?: Query;
  params?: Params;
  response?: Response;
};

export type EndpointRequest<T extends ApiEndpoint> = {
  body: T["body"] extends z.ZodType ? z.infer<T["body"]> : undefined;
  query: T["query"] extends z.ZodType ? z.infer<T["query"]> : undefined;
  params: T["params"] extends z.ZodType ? z.infer<T["params"]> : undefined;
};

export type EndpointResponse<T extends ApiEndpoint> = T["response"] extends z.ZodType
  ? z.infer<T["response"]>
  : unknown;
