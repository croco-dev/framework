import "reflect-metadata";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { buildSchema } from "type-graphql";
import { HealthResolver } from "./resolvers/health.resolver.js";

async function bootstrap() {
  const schema = await buildSchema({
    resolvers: [HealthResolver],
    validate: false,
  });

  const server = new ApolloServer({ schema });
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
  });
  console.log(`🚀 GraphQL server ready at ${url}`);
}

bootstrap().catch(console.error);
