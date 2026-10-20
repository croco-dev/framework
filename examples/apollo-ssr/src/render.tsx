import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { ApolloProvider } from "@apollo/client/react";
import { prerenderStatic } from "@apollo/client/react/ssr";
import { ProblemFactory } from "@croco/problems-core";
import { gql } from "@apollo/client";
import { createApolloSession } from "@croco/frontend-react/apollo";
import { ProductDetailDocument } from "./generated/graphql";
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
    headers: { cookie },
  });
  signal?.addEventListener("abort", session.dispose, { once: true });
  try {
    // This result belongs to server rendering only and must not enter the browser cache.
    await session.client.query({
      query: gql`
        query ServerOnly {
          serverOnly
        }
      `,
    });
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
    const hydration = session.extract([
      { query: ProductDetailDocument, variables: { id: "p1", variant: "member" } },
    ]);
    return { result, hydration };
  } finally {
    signal?.removeEventListener("abort", session.dispose);
    session.dispose();
  }
}
