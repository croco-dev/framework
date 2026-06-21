import "reflect-metadata";
import { ApolloServer } from "@apollo/server";
import { startStandaloneServer } from "@apollo/server/standalone";
import { createSchema } from "./schema.js";

async function bootstrap() {
  const schema = await createSchema();

  const server = new ApolloServer({ schema });
  const { url } = await startStandaloneServer(server, {
    listen: { port: 4000 },
  });
  console.log(`🚀 GraphQL server ready at ${url}`);
}

bootstrap().catch(console.error);
