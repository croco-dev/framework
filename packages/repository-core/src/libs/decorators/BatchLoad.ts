import { Container, Context } from "@croco/framework-context";
import { BATCH_LOADER_FACTORY_TOKEN, type IBatchLoaderFactory } from "../IBatchLoaderFactory";
import {
  BatchLoaderFactoryNotRegisteredProblem,
  BatchLoaderFactoryResolutionProblem,
  BatchLoaderScopeCollisionProblem,
} from "../problems/BatchLoadProblems";

type BatchKeyedRecord = Record<string, unknown>;

type BatchLoadableRepository<TKey, TValue extends BatchKeyedRecord> = {
  findByIds?: (ids: TKey[]) => Promise<ReadonlyArray<TValue>>;
};

type BatchLoadMethod<TKey, TValue> = (this: object, arg: TKey) => Promise<TValue | null>;

type BatchLoadScopeClaim = {
  definitionId: number;
  scopeId: number;
};

type BatchLoadScopeRegistry = {
  definitionIds: Map<object, number>;
  nextDefinitionId: number;
  nextScopeId: number;
  scopeIds: Map<BatchLoadScope, number>;
  explicitNameClaims: Map<string, BatchLoadScopeClaim>;
};

class BatchLoadScopeRegistryCacheKey {}

function hasBatchKey(value: unknown, key: string): value is BatchKeyedRecord {
  return typeof value === "object" && value !== null && key in value;
}

/**
 * Opaque identity for the repository, tenant, data source, or transaction boundary that may
 * safely share one request-scoped loader.
 *
 * Equal primitive values intentionally share. Use an object or symbol when reference identity
 * is required.
 */
export type BatchLoadScope = string | number | bigint | boolean | symbol | object;

export type BatchLoadScopeResolver<TRepository extends object = object> = (
  repository: TRepository,
) => BatchLoadScope;

export type BatchLoadOptions<TRepository extends object = object> = {
  /**
   * The field name to use as the key for mapping results.
   * This is required to ensure the order of results matches the order of keys.
   * Example: 'id'
   */
  by: string;

  /**
   * The name of the DataLoader.
   * If not provided, it defaults to `${ClassName}:${methodName}`.
   */
  name?: string;

  /**
   * Resolves the repository, tenant, data source, or transaction identity that may safely share
   * one request-scoped loader. The receiver instance is used when this option is omitted.
   */
  scope?: BatchLoadScopeResolver<TRepository>;
};

function getOrCreateScopeRegistry(): BatchLoadScopeRegistry | undefined {
  const contextCache = Context.getCache();
  if (!contextCache) {
    return undefined;
  }

  const existingRegistry = contextCache.get(BatchLoadScopeRegistryCacheKey) as
    | BatchLoadScopeRegistry
    | undefined;
  if (existingRegistry) {
    return existingRegistry;
  }

  const registry: BatchLoadScopeRegistry = {
    definitionIds: new Map(),
    nextDefinitionId: 1,
    nextScopeId: 1,
    scopeIds: new Map(),
    explicitNameClaims: new Map(),
  };
  contextCache.set(BatchLoadScopeRegistryCacheKey, registry);
  return registry;
}

function getOrCreateDefinitionId(
  registry: BatchLoadScopeRegistry,
  definitionIdentity: object,
): number {
  const existingId = registry.definitionIds.get(definitionIdentity);
  if (existingId !== undefined) {
    return existingId;
  }

  const definitionId = registry.nextDefinitionId;
  registry.nextDefinitionId += 1;
  registry.definitionIds.set(definitionIdentity, definitionId);
  return definitionId;
}

function getOrCreateScopeId(
  registry: BatchLoadScopeRegistry,
  scopeIdentity: BatchLoadScope,
): number {
  const existingId = registry.scopeIds.get(scopeIdentity);
  if (existingId !== undefined) {
    return existingId;
  }

  const scopeId = registry.nextScopeId;
  registry.nextScopeId += 1;
  registry.scopeIds.set(scopeIdentity, scopeId);
  return scopeId;
}

function getEffectiveLoaderName(
  displayName: string,
  explicitName: string | undefined,
  definitionIdentity: object,
  scopeIdentity: BatchLoadScope,
): string {
  const registry = getOrCreateScopeRegistry();
  if (!registry) {
    return displayName;
  }

  const definitionId = getOrCreateDefinitionId(registry, definitionIdentity);
  const scopeId = getOrCreateScopeId(registry, scopeIdentity);

  if (explicitName !== undefined) {
    const existingClaim = registry.explicitNameClaims.get(explicitName);
    if (
      existingClaim &&
      (existingClaim.definitionId !== definitionId || existingClaim.scopeId !== scopeId)
    ) {
      throw new BatchLoaderScopeCollisionProblem(explicitName);
    }

    registry.explicitNameClaims.set(explicitName, { definitionId, scopeId });
  }

  return `@croco/repository-core/BatchLoad:${JSON.stringify({
    name: displayName,
    definition: definitionId,
    scope: scopeId,
  })}`;
}

function getBatchLoaderFactory(): IBatchLoaderFactory {
  if (!Container.has(BATCH_LOADER_FACTORY_TOKEN)) {
    throw new BatchLoaderFactoryNotRegisteredProblem();
  }

  try {
    return Container.get(BATCH_LOADER_FACTORY_TOKEN);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new BatchLoaderFactoryResolutionProblem(message);
  }
}

export function BatchLoad<TRepository extends object = object>(
  options: BatchLoadOptions<TRepository>,
): MethodDecorator {
  return (target: object, propertyKey: string | symbol, descriptor: PropertyDescriptor) => {
    const originalMethod = descriptor.value as BatchLoadMethod<unknown, unknown>;
    const className = target.constructor.name;
    const methodName = String(propertyKey);
    const explicitName = options.name || undefined;
    const displayName = explicitName ?? `${className}:${methodName}`;
    const definitionIdentity = {};

    descriptor.value = async function (
      this: BatchLoadableRepository<unknown, BatchKeyedRecord> & TRepository,
      arg: unknown,
    ) {
      const scopeIdentity = options.scope ? options.scope(this) : this;
      const effectiveLoaderName = getEffectiveLoaderName(
        displayName,
        explicitName,
        definitionIdentity,
        scopeIdentity,
      );
      const batchLoaderFactory = getBatchLoaderFactory();
      const batchFn = async (keys: ReadonlyArray<unknown>) => {
        // 1. Try to use findByIds if it exists (Optimization)
        if (typeof this.findByIds === "function") {
          const results = await this.findByIds([...keys]);

          // Map results by the 'by' key to ensure order matches 'keys'
          const resultMap = new Map<unknown, BatchKeyedRecord>();
          for (const item of results) {
            if (hasBatchKey(item, options.by)) {
              resultMap.set(item[options.by], item);
            }
          }

          // Return results in the same order as keys
          return keys.map((key) => resultMap.get(key) || null);
        }

        // 2. Fallback: Call original method for each key in parallel
        // This is useful when the class doesn't implement findByIds
        // or for methods other than findById.
        return Promise.all(
          keys.map(async (key) => {
            try {
              // Call the original method
              return await originalMethod.call(this, key);
            } catch (error) {
              // DataLoader expects Errors to be returned, not thrown, for partial failures
              return error instanceof Error ? error : new Error(String(error));
            }
          }),
        );
      };

      // Create (or retrieve context-scoped) DataLoader
      const loader = batchLoaderFactory.create({
        name: effectiveLoaderName,
        batchFn,
      });

      // Delegate the call to the loader
      return loader.load(arg);
    };

    return descriptor;
  };
}
