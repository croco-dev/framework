import "reflect-metadata";
import { Context } from "@croco/framework-context";
import type { Guard } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import { Body, Controller, Ctx, Get, Post, UseGuards } from "@croco/protocols-rest";
import { createTrpcRouter } from "@croco/protocols-trpc";
import type { TrpcExecutionContext } from "@croco/protocols-trpc";
import { createGraphQLFetchHandler } from "@croco/transports-graphql/fetch";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { buildSchema } from "graphql";
import { createGraphQLFixture } from "./graphqlFixture";
import { z } from "zod";
import { waitForOverlappingRequests } from "./requestOverlap";

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
    await waitForOverlappingRequests(context.request);
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
export function createProtocolFixture(schemaSDL: string) {
  const graphql = createGraphQLFetchHandler(createGraphQLFixture(schemaSDL));
  return {
    async fetch(
      request: Request,
      runtime?: { readonly requestId?: string; readonly abortSignal?: AbortSignal },
    ) {
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
  };
}
