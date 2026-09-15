import { execFile } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import type { BillableUsageEvent } from "@croco/metering-core";
import { describe, expect, it } from "vitest";
import { FileBillableUsageJournal } from "../demo/FileBillableUsageJournal";

const NOW = new Date("2026-01-02T00:00:00.000Z");
const execFileAsync = promisify(execFile);

describe("FileBillableUsageJournal", () => {
  it("preserves sequential appends from separate journal instances", async () => {
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

  it("rejects conflicting duplicate events", async () => {
    await withStateDirectory(async (stateDir) => {
      const journal = new FileBillableUsageJournal(join(stateDir, "journal.sqlite"), NOW);
      await journal.append(billableEvent("usage-1", 1));

      await expect(journal.append(billableEvent("usage-1", 2))).rejects.toThrow("EVENT_CONFLICT");
    });
  });

  it("accepts equivalent duplicate events regardless of property order", async () => {
    await withStateDirectory(async (stateDir) => {
      const journal = new FileBillableUsageJournal(join(stateDir, "journal.sqlite"), NOW);
      await journal.append(billableEvent("usage-1", 1));
      const reordered = {
        dimensions: {},
        value: 1,
        unit: "request",
        aggregation: "COUNT" as const,
        meterId: "api_requests",
        tenantId: "tenant_acme",
        eventId: "usage-1",
      };

      await expect(journal.append(reordered)).resolves.toMatchObject({ outcome: "duplicate" });
    });
  });

  it("rejects invalid leases", async () => {
    await withStateDirectory(async (stateDir) => {
      const journal = new FileBillableUsageJournal(join(stateDir, "journal.sqlite"), NOW);

      await expect(
        journal.claimNext({ ownerId: "worker-1", leaseDurationMs: 0, now: NOW }),
      ).rejects.toThrow("INVALID_LEASE");
    });
  });

  it("rejects stale claims", async () => {
    await withStateDirectory(async (stateDir) => {
      const journal = new FileBillableUsageJournal(join(stateDir, "journal.sqlite"), NOW);
      await journal.append(billableEvent("usage-1", 1));
      await journal.markDeliverable("usage-1", NOW);
      const claim = await journal.claimNext({
        ownerId: "worker-1",
        leaseDurationMs: 1_000,
        now: NOW,
      });
      if (!claim) throw new Error("Expected one journal claim.");

      await expect(journal.markAccepted(claim, new Date(NOW.getTime() + 1_000))).rejects.toThrow(
        "STALE_CLAIM",
      );
    });
  });

  it("issues one claim with a monotonically increasing fencing token", async () => {
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
