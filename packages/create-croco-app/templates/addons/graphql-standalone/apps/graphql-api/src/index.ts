import "reflect-metadata";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { formatCrocoGraphQLError } from "./formatGraphQLError.js";
import { createGraphQLContext, createSchema } from "./schema.js";
import type { GraphQLAuthContext } from "./schema.js";

function normalizeHeaders(
  headers: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  return Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [
      key,
      Array.isArray(value) ? value.join(", ") : value,
    ]),
  );
}

async function bootstrap() {
  const schema = await createSchema();

  const server = new ApolloServer<GraphQLAuthContext>({
    schema,
    formatError: formatCrocoGraphQLError,
  });
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
    context: async ({ req }) => createGraphQLContext(normalizeHeaders(req.headers)),
  });
  console.log(`🚀 GraphQL server ready at ${url}`);
}

bootstrap().catch(console.error);
