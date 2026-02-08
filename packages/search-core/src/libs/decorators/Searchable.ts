import { MetadataStorage } from '@croco/framework-context';
import { SEARCHABLE_METADATA } from './constants';

export type SearchableOptions = {
  index?: string;
  autoSync?: boolean;
};

export type SearchableMetadata = {
  index: string;
  autoSync: boolean;
  target: Function;
};

export { SEARCHABLE_METADATA };

export function Searchable(options: SearchableOptions = {}): ClassDecorator {
  return (target: Function) => {
    const metadata: SearchableMetadata = {
      index: options.index ?? target.name.toLowerCase(),
      autoSync: options.autoSync ?? false,
      target,
    };
    MetadataStorage.define(SEARCHABLE_METADATA, target, metadata);
  };
}

export function getSearchableMetadata(target: Function): SearchableMetadata | undefined {
  return MetadataStorage.get<SearchableMetadata>(SEARCHABLE_METADATA, target);
}

export function isSearchable(target: Function): boolean {
  return getSearchableMetadata(target) !== undefined;
}
