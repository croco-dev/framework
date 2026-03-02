import { buildSchema } from 'type-graphql';
import { HealthResolver } from './resolvers/health.resolver.js';

export async function createSchema() {
  return buildSchema({
    resolvers: [HealthResolver],
    validate: false,
  });
}
