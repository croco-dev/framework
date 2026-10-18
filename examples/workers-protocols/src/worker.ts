import "reflect-metadata";
import { Context } from "@croco/framework-context";
import type { Guard } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import { Body, Controller, Ctx, Get, Post, UseGuards } from "@croco/protocols-rest";
import { createTrpcRouter } from "@croco/protocols-trpc";
import type { TrpcExecutionContext } from "@croco/protocols-trpc";
import { createCloudflareWorkersHost } from "@croco/preset-cloudflare/fetch";
import { createGraphQLFetchHandler } from "@croco/transports-graphql/fetch";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { buildSchema } from "graphql";
import schemaSDL from "./schema.graphql";
import { createGraphQLFixture } from "./graphqlFixture";
import { z } from "zod";

const inputSchema = z.object({ name: z.string().min(2) });

// Synthetic credentials for a local conformance fixture, never production authentication.
function principal(request: Request) {
  const token = request.headers.get("authorization");
  if (token !== "Bearer tenant-a" && token !== "Bearer tenant-b") {
    throw ProblemFactory.unauthorized("workers-protocols/unauthorized", "Authentication required");
  }
  return { id: token.slice(7) };
}

class AuthGuard implements Guard<TrpcExecutionContext> {
  canActivate(context: TrpcExecutionContext): boolean {
    principal(context.getRequest());
    return true;
  }
}

@Controller("/probe")
@UseGuards(AuthGuard)
class ProbeController {
  @Get("/")
  async read(@Ctx() context: { request: Request }): Promise<string> {
    await Promise.resolve();
    return `${Context.get()?.tenantId}:${context.request.headers.get("cookie")}`;
  }

  @Get("/signal")
  signal(@Ctx() context: { request: Request; hostRuntime: { abortSignal: AbortSignal } }): boolean {
    return (
      context.request.signal.aborted && context.hostRuntime.abortSignal === context.request.signal
    );
  }

  @Post("/")
  async write(@Body(inputSchema) input: z.infer<typeof inputSchema>): Promise<string> {
    await Promise.resolve();
    return `${Context.get()?.tenantId}:${input.name}`;
  }
}

export const router = createTrpcRouter([ProbeController]);
const graphql = createGraphQLFetchHandler(createGraphQLFixture(schemaSDL));

const host = createCloudflareWorkersHost({
  fetch(request, runtime) {
    // The host supplies platform, abort signal and request identity. The fixture authenticates tenant identity.
    return Context.run({ requestId: runtime?.requestId ?? crypto.randomUUID() }, async () => {
      if (new URL(request.url).pathname === "/graphql") return graphql(request);
      if (new URL(request.url).pathname === "/unsupported-subscriptions") {
        try {
          createGraphQLFetchHandler({
            schema: buildSchema(
              "type Query { value: String } type Subscription { updates: String }",
            ),
          });
        } catch (error) {
          return Response.json(
            { code: error instanceof Error && "code" in error ? error.code : "unknown" },
            { status: 400 },
          );
        }
      }
      return fetchRequestHandler({
        endpoint: "/trpc",
        req: request,
        router,
        createContext: ({ resHeaders }) => {
          resHeaders.append("set-cookie", "trpc=three; HttpOnly; Path=/");
          const user = request.headers.get("authorization")?.slice(7);
          return { request, tenantId: user, hostRuntime: runtime };
        },
      });
    });
  },
});

export default {
  fetch(request: Request, env: Parameters<typeof host>[1], context: Parameters<typeof host>[2]) {
    if (new URL(request.url).pathname === "/aborted-trpc") {
      const controller = new AbortController();
      controller.abort();
      return host(
        new Request("http://worker/trpc/probe.signal", {
          headers: request.headers,
          signal: controller.signal,
        }),
        env,
        context,
      );
    }
    return host(request, env, context);
  },
};
