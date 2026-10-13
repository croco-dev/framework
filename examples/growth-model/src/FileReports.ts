import { createHash } from "node:crypto";
import { readFile, writeFile, rename } from "node:fs/promises";
import { join } from "node:path";
import { GrowthWorkbenchProblem } from "@croco/admin-core";
import type { GrowthReportStore, GrowthReportRecord } from "@croco/admin-core";
import type { GrowthScope } from "@croco/metrics-core";
/** Synthetic demo only: one process, private temporary files and an atomic audit append. */
export function fileReports(directory: string): GrowthReportStore {
  const path = (scope: GrowthScope, id: string) =>
    join(
      directory,
      createHash("sha256")
        .update(JSON.stringify([scope.appId, scope.environment, scope.tenantId, id]))
        .digest("hex") + ".json",
    );
  async function history(scope: GrowthScope, id: string): Promise<GrowthReportRecord[]> {
    try {
      return JSON.parse(await readFile(path(scope, id), "utf8")) as GrowthReportRecord[];
    } catch (error) {
      if (error && typeof error === "object" && "code" in error && error.code === "ENOENT")
        return [];
      throw error;
    }
  }
  let pending = Promise.resolve();
  return {
    read: async (scope, id) => (await history(scope, id)).at(-1),
    append: async (scope, record, expectedRevision) => {
      const run = pending.then(async () => {
        const records = await history(scope, record.id);
        if (
          (records.at(-1)?.revision ?? 0) !== expectedRevision ||
          record.revision !== expectedRevision + 1
        )
          throw new GrowthWorkbenchProblem("revision-conflict");
        if (
          records.some(
            (prior) =>
              prior.report.model.id === record.report.model.id &&
              prior.report.model.version === record.report.model.version &&
              prior.report.modelHash !== record.report.modelHash,
          )
        )
          throw new GrowthWorkbenchProblem("revision-conflict");
        records.push(record);
        const target = path(scope, record.id);
        await writeFile(target + ".tmp", JSON.stringify(records), { mode: 0o600 });
        await rename(target + ".tmp", target);
      });
      pending = run.then(
        () => undefined,
        () => undefined,
      );
      await run;
    },
  };
}
