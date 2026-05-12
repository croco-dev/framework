import { MetadataStorage } from "@croco/framework-context";
import type { SearchDerivedFieldConfig, SearchFieldConfig } from "../types";
import { SEARCH_FIELD_METADATA } from "./constants";

export type SearchFieldOptions = SearchFieldConfig;

export type SearchFieldMetadata = {
  propertyKey: string;
  searchable: boolean;
  filterable: boolean;
  sortable: boolean;
  derived: SearchDerivedFieldConfig[];
};

export { SEARCH_FIELD_METADATA };

export function SearchField(options: SearchFieldOptions = {}): PropertyDecorator {
  return (target: object, propertyKey: string | symbol) => {
    const key = String(propertyKey);
    const existing =
      MetadataStorage.get<SearchFieldMetadata[]>(SEARCH_FIELD_METADATA, target.constructor) ?? [];

    const metadata: SearchFieldMetadata = {
      propertyKey: key,
      searchable: options.searchable ?? true,
      filterable: options.filterable ?? false,
      sortable: options.sortable ?? false,
      derived: options.derived ?? [],
    };

    MetadataStorage.define(SEARCH_FIELD_METADATA, target.constructor, [...existing, metadata]);
  };
}

export function getSearchFieldsMetadata(target: Function): SearchFieldMetadata[] {
  return MetadataStorage.get<SearchFieldMetadata[]>(SEARCH_FIELD_METADATA, target) ?? [];
}
