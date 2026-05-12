"use client";
import {
  ApolloClient,
  ApolloNextAppProvider,
  HttpLink,
  InMemoryCache,
} from "@apollo/experimental-nextjs-app-support";

function makeClient() {
  return new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({
      uri: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/graphql",
    }),
  });
}

export function Providers({ children }: { children: React.ReactNode }) {
  return <ApolloNextAppProvider makeClient={makeClient}>{children}</ApolloNextAppProvider>;
}
