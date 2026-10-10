import "reflect-metadata";
import { Container } from "@croco/framework-context";
import {
  GRAPHQL_GUARDS_KEY,
  GRAPHQL_INTERCEPTORS_KEY,
  GRAPHQL_ROLES_KEY,
  GraphQLRolesGuard,
  GuardInterceptor,
  InterceptorChain,
} from "@croco/protocols-graphql";
import type {
  ClassType,
  GraphQLGuard,
  GraphQLInterceptor,
  MiddlewareFn,
} from "@croco/protocols-graphql";
import type { GraphQLSchema } from "graphql";
import { getMetadataStorage } from "type-graphql";

type ResolverMethodMetadata = {
  readonly getObjectType?: () => Function;
  readonly methodName: string;
  readonly schemaName: string;
  readonly target: Function;
};

/**
 * Executes the guard, role, and interceptor declarations that the GraphQL
 * contract snapshot reads from each resolver method.
 */
export function createGraphQLExecutionMiddleware(
  resolverTypes: readonly Function[],
): MiddlewareFn<Record<string, unknown>> {
  const resolverTypeSet = new Set(resolverTypes);
  const resolverClasses = getMetadataStorage().resolverClasses.map(({ target }) => target);

  return async (resolverData, next) => {
    const resolverMethod = getResolverMethod(
      resolverData.info.parentType.name,
      resolverData.info.fieldName,
      resolverTypeSet,
      resolverClasses,
    );

    if (!resolverMethod) {
      return next();
    }

    const guards = resolveProviders<GraphQLGuard>(
      GRAPHQL_GUARDS_KEY,
      resolverMethod.prototype,
      resolverMethod.methodName,
    );
    const interceptors = resolveProviders<GraphQLInterceptor>(
      GRAPHQL_INTERCEPTORS_KEY,
      resolverMethod.prototype,
      resolverMethod.methodName,
    );
    appendRolesGuard(guards, resolverMethod);

    if (guards.length === 0 && interceptors.length === 0) {
      return next();
    }

    return InterceptorChain.execute(
      [new GuardInterceptor(guards), ...interceptors],
      resolverData,
      next,
    );
  };
}

/**
 * Guards subscription setup before TypeGraphQL creates or retains an async iterator.
 * TypeGraphQL global middleware only runs when a subscription payload resolves.
 */
export function bindGraphQLSubscriptionPolicies(
  schema: GraphQLSchema,
  resolverTypes: readonly Function[],
): void {
  const subscriptionType = schema.getSubscriptionType();
  if (!subscriptionType) {
    return;
  }

  const resolverTypeSet = new Set(resolverTypes);
  const resolverClasses = getMetadataStorage().resolverClasses.map(({ target }) => target);

  for (const [fieldName, field] of Object.entries(subscriptionType.getFields())) {
    const resolverMethod = getResolverMethod(
      "Subscription",
      fieldName,
      resolverTypeSet,
      resolverClasses,
    );
    const subscribe = field.subscribe;

    if (!resolverMethod || !subscribe) {
      continue;
    }

    field.subscribe = async (root, args, context, info) => {
      const guards = resolveGuards(resolverMethod);
      if (guards.length > 0) {
        await new GuardInterceptor(guards).intercept(
          { root, args, context: context as Record<string, unknown>, info },
          { handle: async () => undefined },
        );
      }

      return subscribe(root, args, context, info);
    };
  }
}

function getResolverMethod(
  parentTypeName: string,
  fieldName: string,
  resolverTypes: ReadonlySet<Function>,
  resolverClasses: readonly Function[],
): { prototype: object; methodName: string } | undefined {
  const storage = getMetadataStorage();
  const methods = getResolverMethods(parentTypeName, storage);
  let resolverMethod: { prototype: object; methodName: string } | undefined;

  for (const method of methods) {
    if (!matchesField(method, parentTypeName, fieldName, storage)) {
      continue;
    }

    // TypeGraphQL remaps all decorated resolver classes before filtering selected resolvers.
    let resolverType = method.target;
    for (const target of resolverClasses) {
      if (Object.prototype.isPrototypeOf.call(resolverType, target)) {
        resolverType = target;
      }
    }
    if (!resolverTypes.has(resolverType) || typeof resolverType.prototype !== "object") {
      continue;
    }

    resolverMethod = { prototype: resolverType.prototype, methodName: method.methodName };
    // TypeGraphQL selects the first object-field resolver, but the last root handler.
    if (methods === storage.fieldResolvers) {
      return resolverMethod;
    }
  }

  return resolverMethod;
}

function matchesField(
  method: ResolverMethodMetadata,
  parentTypeName: string,
  fieldName: string,
  storage: ReturnType<typeof getMetadataStorage>,
): boolean {
  if (
    parentTypeName === "Query" ||
    parentTypeName === "Mutation" ||
    parentTypeName === "Subscription"
  ) {
    return method.schemaName === fieldName;
  }

  let parentMetadata = [...storage.objectTypes, ...storage.interfaceTypes].find(
    ({ name }) => name === parentTypeName,
  );
  while (parentMetadata) {
    const fields = [
      ...(parentMetadata.interfaceClasses ?? []).flatMap(
        (target) => storage.interfaceTypesCache.get(target)?.fields ?? [],
      ),
      ...(parentMetadata.fields ?? []),
    ];
    const field = fields.reverse().find(({ schemaName }) => schemaName === fieldName);
    if (field) {
      return method.getObjectType?.() === field.target && method.methodName === field.name;
    }
    const parentTarget = Object.getPrototypeOf(parentMetadata.target);
    parentMetadata =
      storage.objectTypesCache.get(parentTarget) ?? storage.interfaceTypesCache.get(parentTarget);
  }
  return false;
}

function getResolverMethods(
  parentTypeName: string,
  storage: ReturnType<typeof getMetadataStorage>,
): readonly ResolverMethodMetadata[] {
  if (parentTypeName === "Query") {
    return storage.queries;
  }

  if (parentTypeName === "Mutation") {
    return storage.mutations;
  }

  if (parentTypeName === "Subscription") {
    return storage.subscriptions;
  }

  return storage.fieldResolvers;
}

function resolveProviders<T extends object>(
  metadataKey: symbol,
  target: object,
  methodName: string,
): T[] {
  const providers = Reflect.getMetadata(metadataKey, target, methodName);

  if (!Array.isArray(providers)) {
    return [];
  }

  return providers.map((provider) => Container.get(provider as ClassType<T>));
}

function resolveGuards(resolverMethod: { prototype: object; methodName: string }): GraphQLGuard[] {
  const guards = resolveProviders<GraphQLGuard>(
    GRAPHQL_GUARDS_KEY,
    resolverMethod.prototype,
    resolverMethod.methodName,
  );
  appendRolesGuard(guards, resolverMethod);
  return guards;
}

function appendRolesGuard(
  guards: GraphQLGuard[],
  resolverMethod: { prototype: object; methodName: string },
): void {
  const roles = Reflect.getMetadata(
    GRAPHQL_ROLES_KEY,
    resolverMethod.prototype,
    resolverMethod.methodName,
  );

  if (Array.isArray(roles) && roles.length > 0) {
    guards.push(new GraphQLRolesGuard(resolverMethod.prototype, resolverMethod.methodName));
  }
}
