"use client";

import { ApolloProvider } from "@apollo/client";
import type { ReactNode } from "react";
import { createApolloClient } from "./apollo-client.js";

const client = createApolloClient();

export function Providers({ children }: { children: ReactNode }) {
  return <ApolloProvider client={client}>{children}</ApolloProvider>;
}
