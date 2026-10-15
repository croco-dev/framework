import { mkdtemp, rm, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createGrowthModelWorkbenchSource } from "@croco/admin-core";
import { request, scope, dataset } from "../fixture";
import { fileReports } from "../FileReports";
describe("Growth model standalone example", () => {
  it("restores a scoped aggregate report after host recreation and retains atomic audit revisions", async () => {
    const directory = await mkdtemp(join(tmpdir(), "growth-model-test-"));
    try {
      const create = () =>
        createGrowthModelWorkbenchSource({
          limits: { maxRows: 100, maxStates: 2, maxHorizon: 4 },
          reports: fileReports(directory),
          adapter: {
            authorize: async (s) => s.tenantId === scope.tenantId,
            actor: async () => "operator",
            read: async () => dataset(),
          },
        });
      const first = create();
      const report = await first.calculate(request);
      expect(report.projection.populations[1]?.[0]).toBeCloseTo(1600 / 19);
      expect(report.backtest.results[0]?.baseline).toBe(10);
      const saved = await first.save(request, "report", 0, report.analysisHash);
      expect(await create().readSaved(scope, "report")).toEqual(saved);
      const outcomes = await Promise.allSettled([
        first.save(request, "report", 1, report.analysisHash),
        first.save(request, "report", 1, report.analysisHash),
      ]);
      expect(outcomes.filter((o) => o.status === "fulfilled")).toHaveLength(1);
      const names = await readdir(directory);
      const name = names.find((n) => n.endsWith(".json"));
      expect(name).toBeDefined();
      if (name) {
        const records = JSON.parse(await readFile(join(directory, name), "utf8"));
        expect(records).toHaveLength(2);
        expect(records[1].previousAnalysisHash).toBe(records[0].report.analysisHash);
        expect(JSON.stringify(records)).not.toContain("subjectId");
      }
      await expect(create().readSaved({ ...scope, tenantId: "other" }, "report")).rejects.toThrow();
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
