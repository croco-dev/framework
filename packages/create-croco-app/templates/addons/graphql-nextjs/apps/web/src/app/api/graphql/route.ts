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

export async function GET(request: NextRequest) {
  return handler(request);
}

export async function POST(request: NextRequest) {
  return handler(request);
}
