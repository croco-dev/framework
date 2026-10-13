import { describe, expect, it, vi } from "vitest";
import { ResearchInvalidProblem, ResearchPersistenceProblem } from "@croco/research-core";
import { DrizzleResearchStore, createResearchSchema } from "../index";
import type { DrizzleResearchClient } from "../index";
const scope = { app: "app", environment: "test", tenantId: "tenant" };
describe("DrizzleResearchStore boundaries", () => {
  it("rejects omitted scope before touching the database and wraps persistence errors", async () => {
    const transaction = vi.fn(async () => {
      throw new Error("private database secret");
    });
    const store = new DrizzleResearchStore({ transaction } as unknown as DrizzleResearchClient);
    await expect(
      store.transact({ ...scope, tenantId: "" }, "study", async () => 1),
    ).rejects.toThrow(ResearchInvalidProblem);
    expect(transaction).not.toHaveBeenCalled();
    await expect(store.transact(scope, "study", async () => 1)).rejects.toThrow(
      ResearchPersistenceProblem,
    );
  });
  it("provides explicit migration diagnostics without disclosing provider messages", async () => {
    await expect(
      createResearchSchema({
        execute: async () => {
          throw new Error("secret");
        },
      }),
    ).rejects.toMatchObject({ code: "research/persistence" });
  });
});
