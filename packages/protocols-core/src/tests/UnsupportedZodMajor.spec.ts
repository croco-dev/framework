import "reflect-metadata";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { z as z4 } from "zod/v4";
import { assertContractGraphHasNoErrors, buildContractGraph } from "../libs/ContractGraph";
import { REST_ROUTES_KEY, type RouteContractMetadata } from "../libs/sharedTypes";
import { Controller, Get, Query } from "./helpers/test-decorators";

describe("unsupported route contract Zod majors", () => {
  it.each(["params", "query", "body", "response"] as const)(
    "rejects Zod 4 %s before misleading binding diagnostics",
    (slot) => {
      @Controller("/posts")
      class PostsController {
        @Get("/")
        list(@Query("offset") _offset: string, @Query("offset") _duplicate: string): void {}
      }
      const contract = {
        method: "GET",
        path: "/posts",
        sourceLocation: { path: "src/posts.ts", line: 12, column: 3 },
        query: z.object({ missing: z.string() }),
        [slot]: z4.object({ offset: z4.number() }),
      } as unknown as RouteContractMetadata;
      Reflect.defineMetadata(
        REST_ROUTES_KEY,
        [{ method: "GET", path: "/", methodName: "list", contract }],
        PostsController,
      );

      const graph = buildContractGraph([PostsController]);
      expect(graph.diagnostics).toEqual([
        expect.objectContaining({
          code: "contract-schema-unsupported-zod-major",
          severity: "error",
          target: "schema",
          routeId: "PostsController.list",
          sourceLocation: contract.sourceLocation,
          message: expect.stringMatching(new RegExp(`${slot}.*Zod major 4.*object`)),
        }),
      ]);
      expect(() => assertContractGraphHasNoErrors(graph)).toThrow(
        "contract-schema-unsupported-zod-major",
      );
    },
  );
});
