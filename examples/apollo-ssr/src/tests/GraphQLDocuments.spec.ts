import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { generate } from "../../codegen.mjs";
import { ProductDetailDocument } from "../generated/graphql";
import type { ApolloClient } from "@apollo/client";

const schema = await readFile(new URL("../schema.graphql", import.meta.url), "utf8");
const source = await readFile(new URL("../operations.graphql", import.meta.url), "utf8");
describe("GraphQLDocuments", () => {
  it("generates native typed documents and fragments from the actual schema", async () => {
    const generated = await generate(schema, source);
    expect(generated).toContain("ProductDetailDocument");
    expect(generated).toContain("ProductCardFragmentDoc");
    expect(generated).toMatch(/Money: \{ input: string; output: string; \}/);
  });
  it("rejects invalid fields, variable declarations and unmapped scalars at codegen", async () => {
    await expect(
      generate(schema, 'query Invalid { product(id: "p1") { unknownField } }'),
    ).rejects.toThrow();
    await expect(
      generate(schema, "query Invalid($id: Int!) { product(id: $id) { id } }"),
    ).rejects.toThrow();
    await expect(generate(schema + "\nscalar Unmapped", source)).rejects.toThrow();
  });
});
// Compiled by the example typecheck, never executed; native Apollo infers variables/result.
function negativeTypes(client: ApolloClient) {
  void client.query({
    query: ProductDetailDocument,
    // @ts-expect-error ID input cannot be an object
    variables: { id: { value: "p1" }, variant: "member" },
  });
  // @ts-expect-error required variant cannot disappear
  void client.query({ query: ProductDetailDocument, variables: { id: "p1" } });
  void client
    .query({ query: ProductDetailDocument, variables: { id: "p1", variant: "member" } })
    .then((result) => {
      // @ts-expect-error custom Money output is a string; product/quote are nullable
      const amount: number = result.data.product.quote.amount;
      return amount;
    });
}
void negativeTypes;
