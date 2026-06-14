import type { Hono } from "hono";
import { describe, expectTypeOf, it } from "vitest";

import type {
  NodeEntry,
  NodeEntryOptions,
  createNodeEntry,
  createNodeServerPreset,
} from "../index";

type NodeApp = { readonly fetch: Hono["fetch"] };
type CreateNodeEntryParameters = [honoApp: NodeApp, options?: NodeEntryOptions];

describe("public types", () => {
  it("does not expose no-op Node preset options", () => {
    expectTypeOf<typeof createNodeServerPreset>().parameters.toEqualTypeOf<[]>();
  });

  it("keeps runtime server options on the Node entry helper", () => {
    expectTypeOf<typeof createNodeEntry>().parameters.toEqualTypeOf<CreateNodeEntryParameters>();
    expectTypeOf<typeof createNodeEntry>().returns.toEqualTypeOf<NodeEntry>();
  });
});
