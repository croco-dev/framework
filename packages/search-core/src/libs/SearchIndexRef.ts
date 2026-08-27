import type { SearchQuery } from "./types";

declare const SEARCH_INDEX_REF_CONTRACT: unique symbol;

type SearchIndexDocumentContract = {
  id: string;
  tenantId: string;
};

export type SearchIndexField<TDocument extends SearchIndexDocumentContract> = Extract<
  keyof TDocument,
  string
>;

export type SearchIndexDefinition<
  TDocument extends SearchIndexDocumentContract,
  TName extends string,
  TSearchableFields extends readonly SearchIndexField<TDocument>[],
  TFilterableFields extends readonly SearchIndexField<TDocument>[],
  TSortableFields extends readonly SearchIndexField<TDocument>[],
> = {
  readonly name: TName;
  readonly primaryKey?: SearchIndexField<TDocument>;
  readonly searchableFields?: TSearchableFields;
  readonly filterableFields?: TFilterableFields;
  readonly sortableFields?: TSortableFields;
};

export type SearchIndexRef<
  TDocument extends SearchIndexDocumentContract = SearchIndexDocumentContract,
  TName extends string = string,
  TSearchableFields extends readonly string[] = readonly string[],
  TFilterableFields extends readonly string[] = readonly string[],
  TSortableFields extends readonly string[] = readonly string[],
> = {
  readonly name: TName;
  readonly primaryKey?: string;
  readonly searchableFields?: TSearchableFields;
  readonly filterableFields?: TFilterableFields;
  readonly sortableFields?: TSortableFields;
  readonly [SEARCH_INDEX_REF_CONTRACT]: {
    readonly document: TDocument;
    readonly searchableField: TSearchableFields[number];
    readonly filterableField: TFilterableFields[number];
    readonly sortableField: TSortableFields[number];
  };
};

export type SearchIndexDocument<TReference extends SearchIndexRef> =
  TReference extends SearchIndexRef<infer TDocument> ? TDocument : never;

type SearchIndexFilterableField<TReference extends SearchIndexRef> =
  TReference extends SearchIndexRef<
    SearchIndexDocumentContract,
    string,
    readonly string[],
    infer TFilterableFields,
    readonly string[]
  >
    ? TFilterableFields[number]
    : never;

type SearchIndexSortableField<TReference extends SearchIndexRef> =
  TReference extends SearchIndexRef<
    SearchIndexDocumentContract,
    string,
    readonly string[],
    readonly string[],
    infer TSortableFields
  >
    ? TSortableFields[number]
    : never;

type SearchIndexFilters<TReference extends SearchIndexRef> = [
  SearchIndexFilterableField<TReference>,
] extends [never]
  ? never
  : Partial<
      Pick<
        SearchIndexDocument<TReference>,
        Extract<SearchIndexFilterableField<TReference>, keyof SearchIndexDocument<TReference>>
      >
    >;

export type SearchIndexQuery<TReference extends SearchIndexRef> = Omit<
  SearchQuery,
  "filters" | "sort"
> & {
  readonly filters?: SearchIndexFilters<TReference>;
  readonly sort?: [SearchIndexSortableField<TReference>] extends [never]
    ? never
    : {
        field: SearchIndexSortableField<TReference>;
        order: "asc" | "desc";
      }[];
};

type SearchIndexQueryFilterFields<TQuery> = TQuery extends { readonly filters: infer TFilters }
  ? keyof TFilters
  : never;

export type SearchIndexQueryInput<
  TReference extends SearchIndexRef,
  TQuery extends SearchIndexQuery<TReference>,
> =
  Exclude<
    SearchIndexQueryFilterFields<TQuery>,
    SearchIndexFilterableField<TReference>
  > extends never
    ? unknown
    : never;

export type SearchIndexDocumentInput<TReference extends SearchIndexRef> = Omit<
  SearchIndexDocument<TReference>,
  "tenantId"
>;

type SearchIndexFactory<TDocument extends SearchIndexDocumentContract> = <
  const TName extends string,
  const TSearchableFields extends readonly SearchIndexField<TDocument>[] = readonly [],
  const TFilterableFields extends readonly SearchIndexField<TDocument>[] = readonly [],
  const TSortableFields extends readonly SearchIndexField<TDocument>[] = readonly [],
>(
  definition: SearchIndexDefinition<
    TDocument,
    TName,
    TSearchableFields,
    TFilterableFields,
    TSortableFields
  >,
) => SearchIndexRef<TDocument, TName, TSearchableFields, TFilterableFields, TSortableFields>;

function freezeFields<TFields extends readonly string[]>(
  fields: TFields | undefined,
): TFields | undefined {
  return fields === undefined ? undefined : (Object.freeze([...fields]) as unknown as TFields);
}

/**
 * Defines one serializable search index while retaining its document and field contracts.
 */
export function defineSearchIndex<
  TDocument extends SearchIndexDocumentContract,
>(): string extends keyof TDocument ? never : SearchIndexFactory<TDocument> {
  const define: SearchIndexFactory<TDocument> = (definition) => {
    const searchableFields = freezeFields(definition.searchableFields);
    const filterableFields = freezeFields(definition.filterableFields);
    const sortableFields = freezeFields(definition.sortableFields);

    return Object.freeze({
      name: definition.name,
      ...(definition.primaryKey === undefined ? {} : { primaryKey: definition.primaryKey }),
      ...(searchableFields === undefined ? {} : { searchableFields }),
      ...(filterableFields === undefined ? {} : { filterableFields }),
      ...(sortableFields === undefined ? {} : { sortableFields }),
    }) as SearchIndexRef<
      TDocument,
      typeof definition.name,
      NonNullable<typeof definition.searchableFields>,
      NonNullable<typeof definition.filterableFields>,
      NonNullable<typeof definition.sortableFields>
    >;
  };

  return define as string extends keyof TDocument ? never : SearchIndexFactory<TDocument>;
}
