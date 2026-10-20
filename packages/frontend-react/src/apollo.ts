/** Opt-in Apollo 4 integration. The application keeps native Apollo hooks and cache policies. */
export { createApolloSession, serializeApolloHydration } from "./libs/apolloSession";
export type {
  ApolloSession,
  ApolloSessionOptions,
  ApolloHydrationSelection,
} from "./libs/apolloSession";
