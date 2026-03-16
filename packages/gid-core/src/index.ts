import type { IdPrefixInstance, IdPrefixRegistry } from './libs/defineIdPrefixes';
import { defineIdPrefixes } from './libs/defineIdPrefixes';
import type { PrefixedId } from './libs/IdPrefix';
import { IdPrefix } from './libs/IdPrefix';
import { IdPrefixProblem, InvalidIdPrefixProblem } from './libs/problems/GidProblems';

/**
 * Creates a type-safe registry for generating and validating prefixed GIDs.
 */
export { defineIdPrefixes };

/**
 * Public contract for a single prefixed GID generator and validator.
 */
export type { IdPrefixInstance };

/**
 * Registry shape returned from {@link defineIdPrefixes}.
 */
export type { IdPrefixRegistry };

/**
 * Generates and validates GIDs for a specific prefix.
 */
export { IdPrefix };

/**
 * Branded string type for a generated prefixed GID.
 */
export type { PrefixedId };

/**
 * Problem thrown when a GID prefix is shorter than the supported minimum.
 */
export { InvalidIdPrefixProblem };

export { IdPrefixProblem };
