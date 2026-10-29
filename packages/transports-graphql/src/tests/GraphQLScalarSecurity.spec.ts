import { createRequire } from "node:module";
import { Worker } from "node:worker_threads";
import { describe, expect, it } from "vitest";

const requireFromTest = createRequire(import.meta.url);

describe("GraphQL scalar security", () => {
  it("rejects adversarial phone inputs before resolvers without blocking the worker", async () => {
    const worker = new Worker(
      `
      const { parentPort, workerData } = require("node:worker_threads");
      const { createRequire } = require("node:module");
      const fromScalars = createRequire(workerData.scalars);
      const { GraphQLPhoneNumber } = fromScalars(workerData.scalars);
      const { GraphQLSchema, GraphQLObjectType, GraphQLString, graphqlSync } = fromScalars("graphql");
      let calls = 0;
      const schema = new GraphQLSchema({
        query: new GraphQLObjectType({
          name: "Query",
          fields: {
            echo: {
              type: GraphQLString,
              args: { phone: { type: GraphQLPhoneNumber } },
              resolve: (_, { phone }) => { calls++; return phone; },
            },
          },
        }),
      });
      const query = "query($phone: PhoneNumber) { echo(phone: $phone) }";
      const validVariable = graphqlSync({ schema, source: query, variableValues: { phone: "+41791234567" } });
      const validLiteral = graphqlSync({ schema, source: '{ echo(phone: "+1 (415) 555-2671") }' });
      const adversarial = "1".repeat(1000) + "x";
      const variable = graphqlSync({ schema, source: query, variableValues: { phone: adversarial } });
      const literal = graphqlSync({ schema, source: '{ echo(phone: "' + adversarial + '") }' });
      parentPort.postMessage({
        validVariable: validVariable.data,
        validLiteral: validLiteral.data,
        variableErrors: variable.errors?.length,
        literalErrors: literal.errors?.length,
        calls,
      });
      `,
      { eval: true, workerData: { scalars: requireFromTest.resolve("graphql-scalars") } },
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const result = await new Promise<unknown>((resolve, reject) => {
        worker.once("message", resolve);
        worker.once("error", reject);
        timer = setTimeout(() => reject(new Error("PhoneNumber coercion did not complete")), 5_000);
      });
      expect(result).toEqual({
        validVariable: { echo: "+41791234567" },
        validLiteral: { echo: "+1 (415) 555-2671" },
        variableErrors: 1,
        literalErrors: 1,
        calls: 2,
      });
    } finally {
      clearTimeout(timer);
      await worker.terminate();
    }
  });
});
