/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
  Money: { input: string; output: string };
};

export type Quote = {
  __typename?: "Quote";
  amount: Scalars["Money"]["output"];
  currency: Scalars["String"]["output"];
};

export type Product = {
  __typename?: "Product";
  id: Scalars["ID"]["output"];
  name: Scalars["String"]["output"];
  quote?: Maybe<Quote>;
};

export type ProductQuoteArgs = {
  variant: Scalars["String"]["input"];
};

export type Query = {
  __typename?: "Query";
  product?: Maybe<Product>;
  serverOnly: Scalars["String"]["output"];
  denied?: Maybe<Scalars["String"]["output"]>;
  requiredDenied: Scalars["String"]["output"];
};

export type QueryProductArgs = {
  id: Scalars["ID"]["input"];
};

export type Mutation = {
  __typename?: "Mutation";
  discount: Product;
};

export type MutationDiscountArgs = {
  id: Scalars["ID"]["input"];
  variant: Scalars["String"]["input"];
};

export type ProductCardFragment = { id: string; name: string };

export type ProductDetailQueryVariables = Exact<{
  id: string | number;
  variant: string;
}>;

export type ProductDetailQuery = {
  product: { id: string; name: string; quote: { amount: string; currency: string } | null } | null;
};

export type DiscountMutationVariables = Exact<{
  id: string | number;
  variant: string;
}>;

export type DiscountMutation = {
  discount: { id: string; quote: { amount: string; currency: string } | null };
};

export const ProductCardFragmentDoc = {
  kind: "Document",
  definitions: [
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "ProductCard" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Product" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ProductCardFragment, unknown>;
export const ProductDetailDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ProductDetail" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "variant" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "product" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "FragmentSpread", name: { kind: "Name", value: "ProductCard" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "quote" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "variant" },
                      value: { kind: "Variable", name: { kind: "Name", value: "variant" } },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "amount" } },
                      { kind: "Field", name: { kind: "Name", value: "currency" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
    {
      kind: "FragmentDefinition",
      name: { kind: "Name", value: "ProductCard" },
      typeCondition: { kind: "NamedType", name: { kind: "Name", value: "Product" } },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          { kind: "Field", name: { kind: "Name", value: "id" } },
          { kind: "Field", name: { kind: "Name", value: "name" } },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ProductDetailQuery, ProductDetailQueryVariables>;
export const DiscountDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "Discount" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "variant" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "String" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "discount" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: { kind: "Variable", name: { kind: "Name", value: "id" } },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "variant" },
                value: { kind: "Variable", name: { kind: "Name", value: "variant" } },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "quote" },
                  arguments: [
                    {
                      kind: "Argument",
                      name: { kind: "Name", value: "variant" },
                      value: { kind: "Variable", name: { kind: "Name", value: "variant" } },
                    },
                  ],
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "amount" } },
                      { kind: "Field", name: { kind: "Name", value: "currency" } },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<DiscountMutation, DiscountMutationVariables>;
