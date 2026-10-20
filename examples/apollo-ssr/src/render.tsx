import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ApolloProvider } from "@apollo/client/react";
import { prerenderStatic } from "@apollo/client/react/ssr";
import { gql } from "@apollo/client";
import { ProblemFactory } from "@croco/problems-core";
import { createApolloSession } from "@croco/frontend-react/apollo";
import { App } from "./App";

export async function render(
  endpoint: string,
  cookie: string,
  owner: string,
  signal?: AbortSignal,
) {
  signal?.throwIfAborted();
  const session = createApolloSession({
    endpoint,
    allowedOrigins: [new URL(endpoint).origin],
    owner,
    ssr: true,
    ownership: "client",
    headers: { cookie },
  });
  signal?.addEventListener("abort", session.dispose, { once: true });
  try {
    // Separate native ownership, without copying server-only results into the client cache.
    const serverOnly = createApolloSession({
      endpoint,
      allowedOrigins: [new URL(endpoint).origin],
      owner: `${owner}:server`,
      ssr: true,
      ownership: "server",
      headers: { cookie },
    });
    signal?.addEventListener("abort", serverOnly.dispose, { once: true });
    try {
      await serverOnly.client.query({
        query: gql`
          query ServerOnly {
            serverOnly
          }
        `,
      });
    } finally {
      signal?.removeEventListener("abort", serverOnly.dispose);
      serverOnly.dispose();
    }
    const tree = createElement(ApolloProvider, {
      client: session.client,
      children: createElement(App),
    });
    const { result, aborted } = await prerenderStatic({
      tree,
      renderFunction: renderToString,
      signal,
    });
    if (aborted)
      throw ProblemFactory.internalServerError("apollo-example/ssr-aborted", "SSR aborted");
    const hydration = session.extract();
    return { result, hydration };
  } finally {
    signal?.removeEventListener("abort", session.dispose);
    session.dispose();
  }
}
