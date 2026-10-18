import { Context as FrameworkContext } from "@croco/framework-context";
import type { RequestContext } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import type { Problem } from "@croco/problems-core";
import { isProblem, problemToGraphQLError } from "@croco/protocols-graphql/fetch";
import { createYoga, maskError, useExecutionCancellation } from "graphql-yoga";
import type { Plugin } from "graphql-yoga";
import type { GraphQLSchema } from "graphql";
import type { GraphQLServerOptions } from "./types";

type YogaHandler = (request: Request) => Promise<Response>;
type GraphQLExecutionContextValue = Record<string, unknown> & {
  tenantId?: unknown;
  user?: unknown;
};
type GraphQLExecuteFn = (...args: readonly unknown[]) => unknown;
type GraphQLContextPropagationPlugin = Plugin<
  Record<string, never>,
  Record<string, never>,
  GraphQLExecutionContextValue
>;
const CROCO_YOGA_LOGGER = {
  debug: (...args: unknown[]) => console.debug(...args),
  info: (...args: unknown[]) => console.info(...args),
  warn: (...args: unknown[]) => console.warn(...args),
  error: (...args: unknown[]) => {
    const [error] = args;
    const problem = getCrocoProblem(error);

    if (problem) {
      console.error(problemToGraphQLError(problem, getGraphQLErrorPath(error)));
      return;
    }

    console.error(...args);
  },
};

/** Fetch-only options require a prepared schema; schema compilation and Node listeners are build/host concerns. */
export type GraphQLFetchOptions = Pick<
  GraphQLServerOptions,
  "context" | "graphqlEndpoint" | "cors" | "plugins"
> & {
  readonly schema: GraphQLSchema;
};

/** Creates a query/mutation handler for Fetch hosts, including Workers with nodejs_compat. */
export function createGraphQLFetchHandler(
  options: GraphQLFetchOptions,
): (request: Request) => Promise<Response> {
  if (!options.schema) {
    throw ProblemFactory.badRequest(
      "transports-graphql/fetch-schema-required",
      "Provide a prepared GraphQLSchema. Run code-first schema compilation outside the fetch transport.",
    );
  }
  if (options.schema.getSubscriptionType()) {
    throw ProblemFactory.badRequest(
      "transports-graphql/fetch-subscriptions-unsupported",
      "Fetch-only GraphQL transport does not support subscriptions. Use a schema without subscription fields.",
    );
  }
  const handler = createYogaHandler(options, true);
  return async (request) => runInGraphQLRequestContext(() => handler(request));
}

export function createYogaHandler(options: GraphQLFetchOptions, fetchOnly = false): YogaHandler {
  const { schema: graphqlSchema, context, graphqlEndpoint = "/graphql", cors, plugins } = options;
  const yoga = createYoga({
    schema: graphqlSchema,
    graphiql: fetchOnly ? false : undefined,
    landingPage: fetchOnly ? false : undefined,
    graphqlEndpoint,
    cors,
    plugins: [useExecutionCancellation(), ...(plugins ?? []), createCrocoContextPlugin()],
    logging: CROCO_YOGA_LOGGER,
    maskedErrors: {
      maskError: maskCrocoProblemError,
    },
    context: async ({ request }) => {
      const userContext = typeof context === "function" ? await context(request) : (context ?? {});
      return {
        ...userContext,
        headers: Object.fromEntries(request.headers),
        request,
      };
    },
  });

  return yoga.fetch.bind(yoga) as YogaHandler;
}

export function runInGraphQLRequestContext<T>(fn: () => Promise<T> | T): Promise<T> | T {
  const activeContext = FrameworkContext.get();
  if (activeContext) {
    return FrameworkContext.run({ ...activeContext }, fn, { inheritScope: true });
  }
  return FrameworkContext.run({ requestId: globalThis.crypto.randomUUID() }, fn);
}

function createCrocoContextPlugin(): GraphQLContextPropagationPlugin {
  return {
    onExecute({ executeFn, setExecuteFn }) {
      const execute: GraphQLExecuteFn = (...args) => Reflect.apply(executeFn, undefined, args);
      setExecuteFn(((...args: readonly unknown[]) => {
        const [executionArgs] = args;
        return FrameworkContext.run(
          propagateGraphQLContext(readContextValue(executionArgs)),
          () => Reflect.apply(execute, undefined, args),
          { inheritScope: true },
        );
      }) as typeof executeFn);
    },
    onSubscribe({ subscribeFn, setSubscribeFn }) {
      const subscribe: GraphQLExecuteFn = (...args) => Reflect.apply(subscribeFn, undefined, args);
      setSubscribeFn(((...args: readonly unknown[]) => {
        const [subscriptionArgs] = args;
        return FrameworkContext.run(
          propagateGraphQLContext(readContextValue(subscriptionArgs)),
          () => Reflect.apply(subscribe, undefined, args),
          { inheritScope: true },
        );
      }) as typeof subscribeFn);
    },
  };
}

function readContextValue(executionArgs: unknown): unknown {
  return isRecord(executionArgs) ? executionArgs.contextValue : undefined;
}

function propagateGraphQLContext(yogaContext: unknown): RequestContext {
  const base = FrameworkContext.get() ?? { requestId: globalThis.crypto.randomUUID() };
  const contextValue = isRecord(yogaContext) ? yogaContext : {};
  const propagated: RequestContext = { ...base };
  const tenantId = readTenantId(contextValue.tenantId);
  if (tenantId !== undefined) {
    propagated.tenantId = tenantId;
  }
  const user = readGraphQLUser(contextValue.user);
  if (user !== undefined) {
    propagated.user = user;
  }
  return propagated;
}

function readTenantId(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function readGraphQLUser(value: unknown): RequestContext["user"] | undefined {
  if (!isRecord(value) || typeof value.id !== "string") {
    return undefined;
  }
  return value as RequestContext["user"];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function maskCrocoProblemError(error: unknown, message: string, isDev?: boolean): Error {
  const problem = getCrocoProblem(error);

  if (!problem) {
    return maskError(error, message, isDev);
  }

  return problemToGraphQLError(problem, getGraphQLErrorPath(error));
}

function getCrocoProblem(error: unknown): Problem | undefined {
  let currentError: unknown = error;
  const visited = new Set<Error>();

  while (currentError instanceof Error && !visited.has(currentError)) {
    if (isProblem(currentError)) {
      return currentError;
    }

    visited.add(currentError);

    if (!isGraphQLError(currentError)) {
      return undefined;
    }

    currentError = currentError.originalError;
  }

  return undefined;
}

function getGraphQLErrorPath(error: unknown): readonly (string | number)[] | undefined {
  return error instanceof Error && isGraphQLError(error) ? error.path : undefined;
}

function isGraphQLError(error: Error): error is Error & {
  originalError?: unknown;
  path?: readonly (string | number)[];
} {
  return error.name === "GraphQLError";
}
