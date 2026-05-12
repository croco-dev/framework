"use client";

import { ApolloClient, HttpLink, InMemoryCache } from "@apollo/client";

export function createApolloClient() {
  return new ApolloClient({
    link: new HttpLink({
      uri: process.env.NEXT_PUBLIC_API_URL ?? "/api/graphql",
    }),
    cache: new InMemoryCache(),
  });
}
