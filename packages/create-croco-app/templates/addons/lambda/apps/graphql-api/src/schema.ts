import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { GraphQLAuthGuard } from "@croco/protocols-graphql";
import type { AuthChecker } from "type-graphql";
import type { GraphQLGuardContext, TokenVerifier } from "@croco/protocols-graphql";
import { HealthResolver } from "./resolvers/health.resolver.js";

export type GraphQLAuthHeaders = Record<string, string | undefined>;

export type GraphQLAuthContext = Record<string, unknown> & {
  readonly headers?: Record<string, string | undefined>;
};

export type CreateSchemaOptions = {
  readonly authVerifier?: TokenVerifier;
};

type GraphQLAuthUser = {
  readonly roles?: readonly string[];
};

const AUTH_TOKEN_ENV = "GRAPHQL_AUTH_TOKEN";
const AUTH_TOKEN_PRINCIPAL_ID = "graphql-token-user";

function createConfiguredAuthVerifier(): TokenVerifier | undefined {
  const configuredToken = process.env[AUTH_TOKEN_ENV];

  if (!configuredToken) {
    return undefined;
  }

  return (token) => (token === configuredToken ? { id: AUTH_TOKEN_PRINCIPAL_ID } : null);
}

export function createGraphQLContext(headers: GraphQLAuthHeaders = {}): GraphQLAuthContext {
  return { headers };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getUserRoles(context: GraphQLAuthContext): readonly string[] {
  const user = context.user;

  if (!isRecord(user)) {
    return [];
  }

  const roles = (user as GraphQLAuthUser).roles;

  return Array.isArray(roles)
    ? roles.filter((role): role is string => typeof role === "string")
    : [];
}

function hasRequiredRole(context: GraphQLAuthContext, roles: readonly string[]): boolean {
  if (roles.length === 0) {
    return true;
  }

  const userRoles = getUserRoles(context);

  return roles.some((role) => userRoles.includes(role));
}

function createAuthChecker(options: CreateSchemaOptions): AuthChecker<GraphQLAuthContext> {
  const authVerifier = options.authVerifier ?? createConfiguredAuthVerifier();

  if (!authVerifier) {
    return () => false;
  }

  const authGuard = new GraphQLAuthGuard({ verifier: authVerifier });

  return async (resolverData, roles) =>
    (await authGuard.canActivate(resolverData as GraphQLGuardContext)) &&
    hasRequiredRole(resolverData.context, roles);
}

export async function createSchema(options: CreateSchemaOptions = {}) {
  return buildSchema({
    resolvers: [HealthResolver],
    authChecker: createAuthChecker(options),
    validate: false,
  });
}
