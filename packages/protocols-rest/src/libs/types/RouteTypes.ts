export type RouteHandler<
  Req extends Record<string, unknown> = Record<string, unknown>,
  Res = unknown,
> = (request: Req) => Res | Promise<Res>;
