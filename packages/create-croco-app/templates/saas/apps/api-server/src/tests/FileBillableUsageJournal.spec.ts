import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { UsageBillingEvent } from "@croco/billing-core";
import type { BillableUsageEvent } from "@croco/metering-core";
import { describe, expect, it } from "vitest";
import { FileBillableUsageJournal } from "../demo/FileBillableUsageJournal";
import { FileUsageBillingGateway } from "../demo/FileUsageBillingGateway";

const NOW = new Date("2026-01-02T00:00:00.000Z");
const execFileAsync = promisify(execFile);

describe("FileBillableUsageJournal", () => {
  it("preserves concurrent appends from separate journal instances", async () => {
    await withStateDirectory(async (stateDir) => {
      const path = join(stateDir, "journal.sqlite");
      const first = new FileBillableUsageJournal(path, NOW);
      const second = new FileBillableUsageJournal(path, NOW);

      await Promise.all([
        first.append(billableEvent("usage-1", 1)),
        second.append(billableEvent("usage-2", 2)),
      ]);

      await expect(first.get("usage-1")).resolves.toMatchObject({ state: "pending" });
      await expect(second.get("usage-2")).resolves.toMatchObject({ state: "pending" });
    });
  });

  it("issues one exclusive claim with a single fencing token", async () => {
    await withStateDirectory(async (stateDir) => {
      const path = join(stateDir, "journal.sqlite");
      const first = new FileBillableUsageJournal(path, NOW);
      const second = new FileBillableUsageJournal(path, NOW);
      await first.append(billableEvent("usage-1", 1));
      await first.markDeliverable("usage-1", NOW);

      const claims = await Promise.all([
        first.claimNext({ ownerId: "worker-1", leaseDurationMs: 30_000, now: NOW }),
        second.claimNext({ ownerId: "worker-2", leaseDurationMs: 30_000, now: NOW }),
      ]);

      const initialClaim = claims.find((claim) => claim !== null);
      expect(claims.filter((claim) => claim !== null)).toHaveLength(1);
      expect(initialClaim?.fencingToken).toBe(1);
      if (!initialClaim) throw new Error("Expected one journal claim.");
      await first.markAccepted(initialClaim, NOW);

      await second.append(billableEvent("usage-2", 1));
      await second.markDeliverable("usage-2", NOW);
      await expect(
        first.claimNext({ ownerId: "worker-3", leaseDurationMs: 30_000, now: NOW }),
      ).resolves.toMatchObject({ event: { eventId: "usage-2" }, fencingToken: 2 });
    });
  });

  it("continues after an exited process abandons a transaction", async () => {
    await withStateDirectory(async (stateDir) => {
      const path = join(stateDir, "journal.sqlite");
      const first = new FileBillableUsageJournal(path, NOW);
      await first.append(billableEvent("usage-1", 1));
      await abandonSqliteTransaction(path);

      const recovered = new FileBillableUsageJournal(path, NOW);
      await expect(recovered.markDeliverable("usage-1", NOW)).resolves.toMatchObject({
        event: { eventId: "usage-1" },
        state: "pending",
      });
    });
  });

  it("preserves concurrent provider ingestion and duplicate acknowledgement", async () => {
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

function billableEvent(eventId: string, value: number): BillableUsageEvent {
  return {
    eventId,
    tenantId: "tenant_acme",
    meterId: "api_requests",
    aggregation: "COUNT",
    unit: "request",
    value,
    dimensions: {},
  };
}

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
  const stateDirectory = await mkdtemp(join(tmpdir(), "croco-file-billable-usage-"));
  try {
    await run(stateDirectory);
  } finally {
    await rm(stateDirectory, { force: true, recursive: true });
  }
}
