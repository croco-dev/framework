import { buildSchema } from "type-graphql";
import { HealthResolver } from "./resolvers/health.resolver";

export async function createSchema() {
  return buildSchema({
    resolvers: [HealthResolver],
    validate: false,
  });
}
