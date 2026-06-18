export type RouteSchemaLike<Output = unknown> = {
  readonly _output: Output;
};

export type RouteRequestSchemas = {
  readonly body?: RouteSchemaLike;
  readonly path?: RouteSchemaLike;
  readonly query?: RouteSchemaLike;
  readonly headers?: RouteSchemaLike;
};

export type DefinedRouteSchema<
  Req extends RouteRequestSchemas = RouteRequestSchemas,
  Res extends RouteSchemaLike = RouteSchemaLike,
> = {
  readonly request: Req;
  readonly response: Res;
};

type InferSchemaOutput<T> = T extends RouteSchemaLike<infer Output> ? Output : unknown;

export type InferRouteSchemaRequest<T extends DefinedRouteSchema> = {
  readonly [Key in keyof T["request"]]: InferSchemaOutput<T["request"][Key]>;
};

export type InferRouteSchemaResponse<T extends DefinedRouteSchema> = InferSchemaOutput<
  T["response"]
>;

export function defineRouteSchema<
  const Res extends RouteSchemaLike,
  const Req extends RouteRequestSchemas = {},
>(schema: { readonly request?: Req; readonly response: Res }): DefinedRouteSchema<Req, Res> {
  return {
    request: (schema.request ?? {}) as Req,
    response: schema.response,
  };
}
