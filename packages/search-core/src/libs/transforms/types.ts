import { Token } from "@croco/framework-context";

declare const SEARCH_TRANSFORM_OPTIONS: unique symbol;
declare const SEARCH_TRANSFORM_DEFINITION: unique symbol;
declare const SEARCH_TRANSFORM_REFERENCE: unique symbol;

type SearchTransformIdentity<TOptions> = {
  readonly id: string;
  readonly defaultSuffix: string;
  readonly [SEARCH_TRANSFORM_OPTIONS]: (options: TOptions) => TOptions;
};

export abstract class SearchTransformAdapter<TOptions = unknown> {
  static readonly token = new Token<SearchTransformAdapter>("SearchTransformAdapter");

  declare readonly [SEARCH_TRANSFORM_OPTIONS]: (options: TOptions) => TOptions;

  abstract readonly id: string;
  abstract readonly defaultSuffix: string;

  abstract transform(input: string, options: TOptions): string;
}

export type SearchTransformDefinition<TOptions = unknown> = SearchTransformIdentity<TOptions> & {
  readonly [SEARCH_TRANSFORM_DEFINITION]: true;
};

export type SearchTransformRef<TOptions = unknown> = SearchTransformIdentity<TOptions> & {
  readonly [SEARCH_TRANSFORM_REFERENCE]: true;
};

export function createSearchTransformDefinition<TOptions>(
  id: string,
  defaultSuffix: string,
): SearchTransformDefinition<TOptions> {
  return Object.freeze({ id, defaultSuffix }) as SearchTransformDefinition<TOptions>;
}

export function createSearchTransformRef<TOptions>(
  id: string,
  defaultSuffix: string,
): SearchTransformRef<TOptions> {
  return Object.freeze({ id, defaultSuffix }) as SearchTransformRef<TOptions>;
}
