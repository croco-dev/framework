import type { Problem } from "@croco/problems-core";
import type { z } from "zod";
import type { HttpMethod } from "../constants";

type AnyZodObject = z.ZodObject<z.ZodRawShape>;
type EmptyObject = Record<never, never>;
type RouteContractTypeError<Message extends string> = {
  readonly __routeContractError__: Message;
};

export type ProblemConstructor<TProblem extends Problem = Problem> = {
  readonly name: string;
  readonly prototype: TProblem;
};

export type RouteContractSpec<
  Method extends HttpMethod = HttpMethod,
  Path extends string = string,
  Params extends AnyZodObject | undefined = AnyZodObject | undefined,
  Query extends AnyZodObject | undefined = AnyZodObject | undefined,
  Body extends z.ZodType | undefined = z.ZodType | undefined,
  Response extends z.ZodType | undefined = z.ZodType | undefined,
  Problems extends readonly ProblemConstructor[] | undefined =
    | readonly ProblemConstructor[]
    | undefined,
> = {
  readonly method: Method;
  readonly path: Path;
  readonly operationId?: string;
  readonly params?: Params;
  readonly query?: Query;
  readonly body?: Body;
  readonly response?: Response;
  readonly problems?: Problems;
};

export type RoutePathParamName<Path extends string> = string extends Path
  ? string
  : Path extends `${string}:${infer Token}/${infer Rest}`
    ? NormalizePathParamToken<Token> | RoutePathParamName<`/${Rest}`>
    : Path extends `${string}:${infer Token}`
      ? NormalizePathParamToken<Token>
      : never;

export type RoutePathParams<TContract extends RouteContractSpec> = TContract extends {
  readonly params: infer Params extends AnyZodObject;
}
  ? z.infer<Params>
  : EmptyObject;

export type RouteQuery<TContract extends RouteContractSpec> = TContract extends {
  readonly query: infer Query extends AnyZodObject;
}
  ? z.infer<Query>
  : EmptyObject;

export type RouteBody<TContract extends RouteContractSpec> = TContract extends {
  readonly body: infer Body extends z.ZodType;
}
  ? z.infer<Body>
  : undefined;

export type RouteResponse<TContract extends RouteContractSpec> = TContract extends {
  readonly response: infer Response extends z.ZodType;
}
  ? z.infer<Response>
  : unknown;

export type RouteProblem<TContract extends RouteContractSpec> = TContract extends {
  readonly problems: readonly (infer ProblemCtor extends ProblemConstructor)[];
}
  ? ProblemCtor["prototype"]
  : never;

export type RouteContractRequest<TContract extends RouteContractSpec> = {
  readonly params: RoutePathParams<TContract>;
  readonly query: RouteQuery<TContract>;
  readonly body: RouteBody<TContract>;
};

export type RouteContractResult<TContract extends RouteContractSpec> =
  | RouteResponse<TContract>
  | Promise<RouteResponse<TContract>>;

export type RouteContractHandler<TContract extends RouteContractSpec> = (
  request: RouteContractRequest<TContract>,
) => RouteContractResult<TContract>;

export type RouteMethodReturn<TContract extends RouteContractSpec> = RouteContractResult<TContract>;

export type RouteParam<
  TContract extends RouteContractSpec,
  Name extends keyof RoutePathParams<TContract> & string,
> = RoutePathParams<TContract>[Name];

export type RouteQueryParam<
  TContract extends RouteContractSpec,
  Name extends keyof RouteQuery<TContract> & string,
> = RouteQuery<TContract>[Name];

export function defineRouteContract<const TContract extends RouteContractSpec>(
  contract: TContract & ValidateRouteContractPathParams<TContract>,
): TContract {
  return contract;
}

export function routeParam<
  TContract extends RouteContractSpec,
  Name extends RoutePathParamName<TContract["path"]> & keyof RoutePathParams<TContract> & string,
>(_contract: TContract, name: Name): Name {
  return name;
}

export function routeQueryParam<
  TContract extends RouteContractSpec,
  Name extends keyof RouteQuery<TContract> & string,
>(_contract: TContract, name: Name): Name {
  return name;
}

export function routePathParamsSchema<
  TContract extends RouteContractSpec & { params: AnyZodObject },
>(contract: TContract): TContract["params"] {
  return contract.params;
}

export function routeQuerySchema<TContract extends RouteContractSpec & { query: AnyZodObject }>(
  contract: TContract,
): TContract["query"] {
  return contract.query;
}

export function routeBodySchema<TContract extends RouteContractSpec & { body: z.ZodType }>(
  contract: TContract,
): TContract["body"] {
  return contract.body;
}

export function routeResponseSchema<TContract extends RouteContractSpec & { response: z.ZodType }>(
  contract: TContract,
): TContract["response"] {
  return contract.response;
}

type ValidateRouteContractPathParams<TContract extends RouteContractSpec> =
  TContract["path"] extends infer Path extends string
    ? ContractPathParamError<Path, ContractParamsSchema<TContract>>
    : unknown;

type ContractParamsSchema<TContract extends RouteContractSpec> = TContract extends {
  readonly params: infer Params extends AnyZodObject;
}
  ? Params
  : undefined;

type ContractPathParamError<Path extends string, Params extends AnyZodObject | undefined> =
  MissingPathParamNames<Path, Params> extends infer Missing extends string
    ? ExtraPathParamNames<Path, Params> extends infer Extra extends string
      ? [Missing] extends [never]
        ? [Extra] extends [never]
          ? unknown
          : RouteContractTypeError<`Route params schema declares '${Extra}' but '${Path}' does not contain that path parameter.`>
        : RouteContractTypeError<`Route path '${Path}' declares path parameter '${Missing}' but the params schema does not.`>
      : never
    : never;

type MissingPathParamNames<Path extends string, Params extends AnyZodObject | undefined> = Exclude<
  RoutePathParamName<Path>,
  ZodObjectKey<Params>
>;

type ExtraPathParamNames<Path extends string, Params extends AnyZodObject | undefined> = Exclude<
  ZodObjectKey<Params>,
  RoutePathParamName<Path>
>;

type ZodObjectKey<Schema extends AnyZodObject | undefined> =
  Schema extends z.ZodObject<infer Shape> ? Extract<keyof Shape, string> : never;

type NormalizePathParamToken<Token extends string> = Token extends `...${infer Name}`
  ? Name
  : Token;
