import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { gql } from "@apollo/client";
import { describe, expect, it } from "vitest";
import { createApolloSession } from "@croco/frontend-react/apollo";
import { render } from "../render";
import { createApi } from "../api";
import { ProductDetailDocument, DiscountDocument } from "../generated/graphql";

const sdl = await readFile(new URL("../schema.graphql", import.meta.url), "utf8");
describe("GraphQLHttp", () => {
  it("preserves guard failures, partial data, null bubbling, normalization and explicit mutation refresh over real HTTP", async () => {
    const api = createApi(sdl);
    const server = createServer((request, response) => {
      void (async () => {
        const chunks: Buffer[] = [];
        for await (const chunk of request) chunks.push(Buffer.from(chunk));
        const result = await api(
          new Request("http://example.test/graphql", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: request.headers.authorization ?? "",
              cookie: request.headers.cookie ?? "",
            },
            body: Buffer.concat(chunks),
          }),
        );
        response.writeHead(result.status, Object.fromEntries(result.headers));
        response.end(Buffer.from(await result.arrayBuffer()));
      })().catch((error) => {
        response.writeHead(500).end(String(error));
      });
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
    const sessions = ["alice", "bob", "invalid"].map((user) =>
      createApolloSession({
        endpoint: origin + "/graphql",
        allowedOrigins: [origin],
        owner: user,
        ssr: true,
        ownership: "client",
        headers: { authorization: `Bearer ${user}` },
      }),
    );
    const [alice, bob, denied] = sessions;
    try {
      const [a, b] = await Promise.all(
        [alice, bob].map((session) =>
          session.client.query({
            query: ProductDetailDocument,
            variables: { id: "p1", variant: "member" },
          }),
        ),
      );
      expect(a.data?.product?.quote?.amount).toBe("17.00");
      expect(b.data?.product?.quote?.amount).toBe("31.00");
      await expect(
        denied.client.query({
          query: ProductDetailDocument,
          variables: { id: "p1", variant: "member" },
        }),
      ).rejects.toThrow("Invalid or expired token");
      const [ssrA, ssrB] = await Promise.all([
        render(origin + "/graphql", "session=alice", "request-a"),
        render(origin + "/graphql", "session=bob", "request-b"),
      ]);
      expect(ssrA.result).toContain("17.00");
      expect(ssrB.result).toContain("31.00");
      expect(ssrA.hydration).not.toContain("server-only-secret");
      expect(ssrB.hydration).not.toContain("server-only-secret");
      const partial = await alice.client.query({
        query: gql`
          query Partial {
            product(id: "p1") {
              id
            }
            denied
          }
        `,
        errorPolicy: "all",
      });
      expect(partial.data).toMatchObject({ product: { id: "p1" }, denied: null });
      expect(partial.error).toBeDefined();
      const bubble = await alice.client.query({
        query: gql`
          query Bubble {
            requiredDenied
          }
        `,
        errorPolicy: "all",
      });
      expect(bubble.data).toBeNull();
      expect(bubble.error).toBeDefined();
      const fieldDenied = await alice.client.query({
        query: ProductDetailDocument,
        variables: { id: "p1", variant: "admin" },
        errorPolicy: "all",
      });
      expect(fieldDenied.data?.product?.quote).toBeNull();
      expect(fieldDenied.error).toBeDefined();
      await alice.client.mutate({
        mutation: DiscountDocument,
        variables: { id: "p1", variant: "member" },
      });
      expect(
        alice.client.readQuery({
          query: ProductDetailDocument,
          variables: { id: "p1", variant: "member" },
        })?.product?.quote?.amount,
      ).toBe("14.00");
      expect(
        bob.client.readQuery({
          query: ProductDetailDocument,
          variables: { id: "p1", variant: "member" },
        })?.product?.quote?.amount,
      ).toBe("31.00");
    } finally {
      sessions.forEach((session) => session.dispose());
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
  });
});
