/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | { [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never };
import type { DocumentNode, ExecutionResult } from "graphql";
import gql from "graphql-tag";
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: { input: string; output: string };
  String: { input: string; output: string };
  Boolean: { input: boolean; output: boolean };
  Int: { input: number; output: number };
  Float: { input: number; output: number };
};

export type Query = {
  __typename?: "Query";
  probe?: Maybe<Scalars["String"]["output"]>;
  broken?: Maybe<Scalars["String"]["output"]>;
};

export type Mutation = {
  __typename?: "Mutation";
  echo: Scalars["String"]["output"];
};

export type MutationEchoArgs = {
  name: Scalars["String"]["input"];
};

export type ProbeQueryVariables = Exact<{ [key: string]: never }>;

export type ProbeQuery = { probe: string | null; broken: string | null };

export type EchoMutationVariables = Exact<{
  name: string;
}>;

export type EchoMutation = { echo: string };

export const ProbeDocument = gql`
  query Probe {
    probe
    broken
  }
`;
export const EchoDocument = gql`
  mutation Echo($name: String!) {
    echo(name: $name)
  }
`;
export type Requester<C = {}, E = unknown> = <R, V>(
  doc: DocumentNode,
  vars?: V,
  options?: C,
) => Promise<ExecutionResult<R, E>> | AsyncIterable<ExecutionResult<R, E>>;
export function getSdk<C, E>(requester: Requester<C, E>) {
  return {
    Probe(variables?: ProbeQueryVariables, options?: C): Promise<ExecutionResult<ProbeQuery, E>> {
      return requester<ProbeQuery, ProbeQueryVariables>(
        ProbeDocument,
        variables,
        options,
      ) as Promise<ExecutionResult<ProbeQuery, E>>;
    },
    Echo(variables: EchoMutationVariables, options?: C): Promise<ExecutionResult<EchoMutation, E>> {
      return requester<EchoMutation, EchoMutationVariables>(
        EchoDocument,
        variables,
        options,
      ) as Promise<ExecutionResult<EchoMutation, E>>;
    },
  };
}
export type Sdk = ReturnType<typeof getSdk>;
