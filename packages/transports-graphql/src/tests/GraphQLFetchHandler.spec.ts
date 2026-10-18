import { Context } from "@croco/framework-context";
import { buildSchema } from "graphql";
import { describe, expect, it } from "vitest";
import { createGraphQLFetchHandler } from "../fetch";

describe("GraphQL fetch handler", () => {
  it("rejects Node schema compilation options at the fetch boundary", () => {
    expect(() => {
      // @ts-expect-error Fetch requires a prepared schema instead of Node compilation options.
      createGraphQLFetchHandler({ schemaOptions: { autoDiscover: true } });
    }).toThrow(expect.objectContaining({ code: "transports-graphql/fetch-schema-required" }));
  });

  it("serves API responses without an HTML IDE or landing page", async () => {
    const handler = createGraphQLFetchHandler({
      schema: buildSchema("type Query { value: String }"),
    });
    const response = await handler(
      new Request("http://local/graphql", { headers: { accept: "text/html" } }),
    );
    expect(response.headers.get("content-type") ?? "").not.toContain("text/html");
  });

  it("rejects subscription schemas with an explicit diagnostic", () => {
    expect(() =>
      createGraphQLFetchHandler({
        schema: buildSchema("type Query { value: String } type Subscription { updates: String }"),
      }),
    ).toThrow(
      expect.objectContaining({ code: "transports-graphql/fetch-subscriptions-unsupported" }),
    );
  });

  it("preserves the host request scope and authenticated context in resolvers", async () => {
    const schema = buildSchema("type Query { value: String }");
    const field = schema.getQueryType()?.getFields().value;
    if (!field) throw new Error("Missing fixture field");
    const key = Symbol();
    field.resolve = async () => {
      await Promise.resolve();
      return `${Context.get()?.tenantId}:${Context.get()?.requestId}:${Context.getCache()?.get(key)}`;
    };
    const handler = createGraphQLFetchHandler({
      schema,
      context: () => ({ tenantId: "verified" }),
    });
    const response = await Context.run(
      { requestId: "host-request", tenantId: "host-tenant" },
      () => {
        Context.getCache()?.set(key, "host-scope");
        return handler(new Request("http://local/graphql?query={value}"));
      },
    );
    expect(await response.json()).toEqual({ data: { value: "verified:host-request:host-scope" } });
    expect(Context.get()).toBeNull();
  });
});
