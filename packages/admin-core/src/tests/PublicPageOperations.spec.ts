import { describe, expect, it, vi } from "vitest";
import { createPublicPageOperations } from "../libs/PublicPageOperations";
import type { PublicPageInspection } from "@croco/seo-core";

describe("PublicPageOperations", () => {
  it("authorizes before inspecting and preserves the shared report", async () => {
    const report: PublicPageInspection = {
      targetId: "product-7",
      state: "partial",
      responseStatus: 200,
      publication: "published",
      diagnostics: [{ code: "SEO_CANONICAL_MISMATCH", field: "canonical" }],
    };
    const inspect = vi.fn(async () => report);
    const denied = createPublicPageOperations({ inspect, authorize: async () => false });
    expect((await denied.inspect("product-7")).state).toBe("denied");
    expect(inspect).not.toHaveBeenCalled();
    const allowed = createPublicPageOperations({ inspect, authorize: async () => true });
    expect(await allowed.inspect("product-7")).toBe(report);
    expect(inspect).toHaveBeenCalledWith("product-7");
  });
});
