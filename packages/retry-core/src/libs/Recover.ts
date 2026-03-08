import 'reflect-metadata';

import { DuplicateRecoverHandlerProblem } from './errors';

const RECOVER_METADATA_KEY = Symbol('retry:recover');

/**
 * Metadata stored for @Recover decorated methods.
 */
export interface RecoverMetadata {
  methodName: string;
  exceptionType?: new (...args: unknown[]) => Error;
}

/**
 * Decorator to mark a method as a recovery handler.
 *
 * The recovery method receives the error as first argument,
 * followed by the original method arguments.
 *
 * @example
 * ```typescript
 * class Service {
 *   @Retryable({ maxAttempts: 3 })
 *   async fetchData(): Promise<Data> {
 *     return await this.api.get('/data');
 *   }
 *
 *   @Recover(ApiError)
 *   async handleApiError(error: ApiError): Promise<Data> {
 *     return this.cache.get('data');
 *   }
 * }
 * ```
 */
export function Recover(exceptionType?: new (...args: unknown[]) => Error): MethodDecorator {
  return (target: object, propertyKey: string | symbol, _descriptor: PropertyDescriptor): void => {
    const methodName = String(propertyKey);

    // Get existing recover methods or create new array
    const recoverMethods: RecoverMetadata[] = Reflect.getMetadata(RECOVER_METADATA_KEY, target) || [];

    const duplicateRecover = recoverMethods.find((recoverMethod) => recoverMethod.exceptionType === exceptionType);

    if (duplicateRecover) {
      throw new DuplicateRecoverHandlerProblem(methodName, exceptionType?.name ?? 'catch-all');
    }

    // Add this method
    recoverMethods.push({
      methodName,
      exceptionType,
    });

    // Store updated metadata
    Reflect.defineMetadata(RECOVER_METADATA_KEY, recoverMethods, target);
  };
}

/**
 * Get all @Recover methods for a class instance.
 */
export function getRecoverMethods(target: object): RecoverMetadata[] {
  return Reflect.getMetadata(RECOVER_METADATA_KEY, target) || [];
}

/**
 * Find the best matching @Recover method for an error.
 * Matches by exception type hierarchy (most specific first).
 */
export function findRecoverMethod(target: object, error: Error): RecoverMetadata | undefined {
  const methods = getRecoverMethods(target);

  if (methods.length === 0) return undefined;

  // Sort by specificity: methods with exceptionType first, then by inheritance depth
  const candidates = methods.filter((m) => {
    if (!m.exceptionType) return true; // Catch-all
    return error instanceof m.exceptionType;
  });

  if (candidates.length === 0) return undefined;

  // Prefer most specific exception type
  const withType = candidates.filter((m) => m.exceptionType);
  if (withType.length > 0) {
    // Sort by inheritance depth (deeper = more specific)
    return withType.sort((a, b) => {
      const exceptionTypeA = a.exceptionType;
      const exceptionTypeB = b.exceptionType;
      if (!exceptionTypeA || !exceptionTypeB) return 0;
      const depthA = getInheritanceDepth(error, exceptionTypeA);
      const depthB = getInheritanceDepth(error, exceptionTypeB);
      return depthA - depthB; // Lower depth = more specific
    })[0];
  }

  // Return catch-all
  return candidates[0];
}

/**
 * Get inheritance depth from error to exception type.
 * Lower = more specific (direct match = 0).
 */
function getInheritanceDepth(error: Error, exceptionType: new (...args: unknown[]) => Error): number {
  let depth = 0;
  let proto = Object.getPrototypeOf(error);

  while (proto) {
    if (proto.constructor === exceptionType) {
      return depth;
    }
    proto = Object.getPrototypeOf(proto);
    depth++;
  }

  return Infinity;
}
