import { Context } from "@croco/framework-context";
import { ProblemFactory } from "@croco/problems-core";
import { GraphQLAuthGuard } from "@croco/protocols-graphql/fetch";
import { buildSchema } from "graphql";
import type { GraphQLFetchOptions } from "@croco/transports-graphql/fetch";

export function createGraphQLFixture(schemaSDL: string): GraphQLFetchOptions {
  const guard = new GraphQLAuthGuard({
    verifier: (token) => (token === "tenant-a" || token === "tenant-b" ? { id: token } : undefined),
  });
  const schema = buildSchema(schemaSDL);
  const fields = schema.getQueryType()?.getFields();
  if (fields) {
    fields.probe.resolve = async (root, args, context, info) => {
      await guard.canActivate({ root, args, context, info });
      await Promise.resolve();
      return `${Context.get()?.tenantId}:${context.request.headers.get("cookie")}`;
    };
    fields.broken.resolve = () => {
      throw ProblemFactory.notFound("workers-protocols/missing", "Missing fixture");
    };
  }

  const mutation = schema.getMutationType()?.getFields().echo;
  if (mutation) {
    mutation.resolve = async (root, args, context, info) => {
      await guard.canActivate({ root, args, context, info });
      return `${Context.get()?.tenantId}:${args.name}`;
    };
  }

  return {
    schema,
    context: (request) => ({ tenantId: request.headers.get("authorization")?.slice(7) }),
    plugins: [
      {
        onResponse({ response }) {
          response.headers.append("set-cookie", "first=one; HttpOnly; Path=/");
          response.headers.append("set-cookie", "second=two; HttpOnly; Path=/");
          response.headers.set("x-protocol", "graphql");
        },
      },
    ],
  };
}
