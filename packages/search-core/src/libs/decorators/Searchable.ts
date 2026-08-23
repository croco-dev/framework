import { MetadataStorage } from "@croco/framework-context";
import { SEARCHABLE_METADATA } from "./constants";
import {
  assertSearchableIndexAvailable,
  findSearchableSourceLocation,
} from "./SearchableMetadataRegistry";
import type { SearchableMetadata, SearchableOptions } from "./SearchableTypes";

export type {
  SearchableIndexDeclaration,
  SearchableMetadata,
  SearchableOptions,
  SearchableSourceLocation,
} from "./SearchableTypes";

export { SEARCHABLE_METADATA };

export function Searchable(options: SearchableOptions = {}): ClassDecorator {
  const sourceLocation = findSearchableSourceLocation(new Error().stack);

  return (target: Function) => {
    const metadata: SearchableMetadata = {
      index: options.index ?? target.name.toLowerCase(),
      autoSync: options.autoSync ?? false,
      target,
      ...(sourceLocation ? { sourceLocation } : {}),
    };
    assertSearchableIndexAvailable(metadata);
    MetadataStorage.define(SEARCHABLE_METADATA, target, metadata);
  };
}

export function getSearchableMetadata(target: Function): SearchableMetadata | undefined {
  return MetadataStorage.get<SearchableMetadata>(SEARCHABLE_METADATA, target);
}

export function isSearchable(target: Function): boolean {
  return getSearchableMetadata(target) !== undefined;
}
