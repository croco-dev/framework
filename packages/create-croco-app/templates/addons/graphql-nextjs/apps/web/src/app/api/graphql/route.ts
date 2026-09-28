import "reflect-metadata";
import { ApolloServer } from "@apollo/server";
import { startServerAndCreateNextHandler } from "@as-integrations/next";
import type { NextRequest } from "next/server.js";
import { formatCrocoGraphQLError } from "../../../server/formatGraphQLError";
import { createSchema } from "../../../server/schema";

const server = new ApolloServer({
  schema: await createSchema(),
  formatError: formatCrocoGraphQLError,
});
const handler = startServerAndCreateNextHandler<NextRequest>(server);

export { handler as GET, handler as POST };
