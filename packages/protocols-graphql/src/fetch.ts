/** Runtime GraphQL guards and Problem conversion without the code-first schema compiler. */
export { GRAPHQL_AUTH_GUARD_OPTIONS, GraphQLAuthGuard } from "./libs/guards/AuthGuard";
export { GraphQLRolesGuard } from "./libs/guards/RolesGuard";
export { GuardChain } from "./libs/guards/GuardChain";
export { isProblem, problemToGraphQLError } from "./libs/errors/ErrorConverter";
export type { AuthGuardOptions, TokenVerifier } from "./libs/guards/AuthGuard";
