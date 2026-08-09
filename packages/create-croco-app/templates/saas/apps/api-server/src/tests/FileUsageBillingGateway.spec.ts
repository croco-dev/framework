import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { UsageBillingEvent } from "@croco/billing-core";
import { describe, expect, it } from "vitest";
import { FileUsageBillingGateway } from "../demo/FileUsageBillingGateway";

const NOW = new Date("2026-01-02T00:00:00.000Z");
const execFileAsync = promisify(execFile);

describe("FileUsageBillingGateway", () => {
  it("preserves sequential provider ingestion and duplicate acknowledgement", async () => {
    await withStateDirectory(async (stateDir) => {
      const path = join(stateDir, "provider.sqlite");
      const first = new FileUsageBillingGateway(path);
      const second = new FileUsageBillingGateway(path);
      const firstEvent = providerEvent("usage-1", 1);
      const secondEvent = providerEvent("usage-2", 2);

      await Promise.all([first.ingest([firstEvent]), second.ingest([secondEvent])]);
      await expect(first.getAcceptedUsage("tenant_acme", "api_requests")).resolves.toBe(3);

      await abandonSqliteTransaction(path);
      await expect(second.ingest([firstEvent])).resolves.toEqual({
        receipts: [{ eventId: "usage-1", status: "duplicate" }],
      });
      await expect(second.getAcceptedUsage("tenant_acme", "api_requests")).resolves.toBe(3);
    });
  });
});

function providerEvent(eventId: string, value: number): UsageBillingEvent {
  return {
    eventId,
    billingAccountId: "tenant_acme",
    meterId: "api_requests",
    occurredAt: NOW,
    value,
  };
}

async function abandonSqliteTransaction(databasePath: string): Promise<void> {
  await execFileAsync(process.execPath, [
    "-e",
    "const { DatabaseSync } = require('node:sqlite'); const database = new DatabaseSync(process.argv[1]); database.exec('BEGIN IMMEDIATE'); process.exit(0)",
    databasePath,
  ]);
}

async function withStateDirectory(run: (stateDirectory: string) => Promise<void>): Promise<void> {
  const stateDirectory = await mkdtemp(join(tmpdir(), "croco-file-usage-provider-"));
  try {
    await run(stateDirectory);
  } finally {
    await rm(stateDirectory, { force: true, recursive: true });
  }
}
