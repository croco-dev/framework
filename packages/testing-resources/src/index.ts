/**
 * Optional real PostgreSQL and Redis resources for Croco TestKernel suites.
 *
 * @packageDocumentation
 */

export {
  type PostgresResourceOptions,
  type PostgresTestConnection,
  postgresResource,
} from "./libs/PostgresResource";
export { TestResourceConfigurationProblem, TestResourceLifecycleProblem } from "./libs/problems";
export { type TestResourceProvider, testResourceProvider } from "./libs/providers";
export {
  type RedisResourceOptions,
  type RedisTestConnection,
  redisResource,
} from "./libs/RedisResource";
export {
  DEFAULT_POSTGRES_IMAGE,
  DEFAULT_REDIS_IMAGE,
  type ResourceImageOptions,
} from "./libs/shared";
