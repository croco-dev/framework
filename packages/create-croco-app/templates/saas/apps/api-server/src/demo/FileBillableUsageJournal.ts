import {
  MeteringTransitionProblem,
  type BillableUsageAppendResult,
  type BillableUsageClaim,
  type BillableUsageClaimOptions,
  type BillableUsageDeliveryState,
  type BillableUsageEvent,
  type BillableUsageFailure,
  type BillableUsageJournal,
  type BillableUsageJournalDiagnostics,
  type BillableUsageJournalEntry,
} from "@croco/metering-core";
import {
  readSqliteFixtureState,
  resetSqliteFixtureState,
  updateSqliteFixtureState,
} from "./SqliteFixtureState";

type StoredEntry = {
  event: BillableUsageEvent;
  state: BillableUsageDeliveryState;
  createdAt: string;
  updatedAt: string;
  retryCount: number;
  ownerId?: string;
  fencingToken?: number;
  leaseExpiresAt?: string;
  retryAt?: string;
  failure?: BillableUsageFailure;
  acceptedAt?: string;
  deliverableAt?: string;
};

type StoredJournal = {
  version: 1;
  nextFencingToken: number;
  entries: Record<string, StoredEntry>;
};

const EMPTY_JOURNAL: StoredJournal = {
  version: 1,
  nextFencingToken: 1,
  entries: {},
};

/** Credential-free, process-independent journal fixture for the generated SaaS recovery drill. */
export class FileBillableUsageJournal implements BillableUsageJournal {
  readonly durability = "persistent" as const;
  constructor(
    private readonly filePath: string,
    private readonly defaultNow: Date,
  ) {}

  async reset(): Promise<void> {
    resetSqliteFixtureState(this.filePath, EMPTY_JOURNAL);
  }

  async append(
    event: BillableUsageEvent,
    now = this.defaultNow,
  ): Promise<BillableUsageAppendResult> {
    return updateSqliteFixtureState(this.filePath, EMPTY_JOURNAL, (journal) => {
      const normalized = normalizeEvent(event);
      const existing = journal.entries[normalized.eventId];
      if (existing) {
        if (stableEvent(existing.event) !== stableEvent(normalized)) {
          throw new MeteringTransitionProblem(
            "append-billable-usage",
            "EVENT_CONFLICT",
            event.eventId,
          );
        }
        return { outcome: "duplicate", entry: toEntry(existing) };
      }

      const entry: StoredEntry = {
        event: normalized,
        state: "pending",
        createdAt: now.toISOString(),
        updatedAt: now.toISOString(),
        retryCount: 0,
      };
      journal.entries[normalized.eventId] = entry;
      return { outcome: "appended", entry: toEntry(entry) };
    });
  }

  async markDeliverable(
    eventId: string,
    now = this.defaultNow,
  ): Promise<BillableUsageJournalEntry> {
    return updateSqliteFixtureState(this.filePath, EMPTY_JOURNAL, (journal) => {
      const entry = requirePending(journal, eventId, "activate-billable-usage");
      entry.deliverableAt = now.toISOString();
      entry.updatedAt = now.toISOString();
      return toEntry(entry);
    });
  }

  async markUndeliverable(
    eventId: string,
    failure: BillableUsageFailure,
    now = this.defaultNow,
  ): Promise<BillableUsageJournalEntry> {
    return updateSqliteFixtureState(this.filePath, EMPTY_JOURNAL, (journal) => {
      const entry = requirePending(journal, eventId, "reject-pending-billable-usage");
      entry.state = "terminal-failed";
      entry.failure = { ...failure };
      entry.updatedAt = now.toISOString();
      return toEntry(entry);
    });
  }

  async claimNext(options: BillableUsageClaimOptions): Promise<BillableUsageClaim | null> {
    if (!Number.isFinite(options.leaseDurationMs) || options.leaseDurationMs <= 0) {
      throw new MeteringTransitionProblem("claim-billable-usage", "INVALID_LEASE", options.ownerId);
    }
    return updateSqliteFixtureState(this.filePath, EMPTY_JOURNAL, (journal) => {
      const now = options.now ?? this.defaultNow;
      const candidate = Object.values(journal.entries)
        .filter((entry) => isClaimable(entry, now))
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt))[0];
      if (!candidate) return null;

      const fencingToken = journal.nextFencingToken;
      journal.nextFencingToken += 1;
      const leaseExpiresAt = new Date(now.getTime() + options.leaseDurationMs);
      candidate.state = "delivering";
      candidate.ownerId = options.ownerId;
      candidate.fencingToken = fencingToken;
      candidate.leaseExpiresAt = leaseExpiresAt.toISOString();
      delete candidate.retryAt;
      candidate.updatedAt = now.toISOString();
      return {
        ...toEntry(candidate),
        state: "delivering",
        ownerId: options.ownerId,
        fencingToken,
        leaseExpiresAt,
      };
    });
  }

  async markAccepted(
    claim: BillableUsageClaim,
    now = this.defaultNow,
  ): Promise<BillableUsageJournalEntry> {
    return updateSqliteFixtureState(this.filePath, EMPTY_JOURNAL, (journal) => {
      const entry = requireClaim(journal, claim, "accept-billable-usage", now);
      entry.state = "accepted";
      entry.acceptedAt = now.toISOString();
      entry.updatedAt = now.toISOString();
      clearClaim(entry);
      return toEntry(entry);
    });
  }

  async markRetryableFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    retryAt: Date,
    now = this.defaultNow,
  ): Promise<BillableUsageJournalEntry> {
    return updateSqliteFixtureState(this.filePath, EMPTY_JOURNAL, (journal) => {
      const entry = requireClaim(journal, claim, "retry-billable-usage", now);
      entry.state = "retryable-failed";
      entry.retryCount += 1;
      entry.failure = { ...failure };
      entry.retryAt = retryAt.toISOString();
      entry.updatedAt = now.toISOString();
      clearClaim(entry, true);
      return toEntry(entry);
    });
  }

  async markTerminalFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    now = this.defaultNow,
  ): Promise<BillableUsageJournalEntry> {
    return updateSqliteFixtureState(this.filePath, EMPTY_JOURNAL, (journal) => {
      const entry = requireClaim(journal, claim, "reject-billable-usage", now);
      entry.state = "terminal-failed";
      entry.failure = { ...failure };
      entry.updatedAt = now.toISOString();
      clearClaim(entry);
      return toEntry(entry);
    });
  }

  async get(eventId: string): Promise<BillableUsageJournalEntry | null> {
    const entry = readSqliteFixtureState(this.filePath, EMPTY_JOURNAL).entries[eventId];
    return entry ? toEntry(entry) : null;
  }

  async getDiagnostics(now = this.defaultNow): Promise<BillableUsageJournalDiagnostics> {
    const entries = Object.values(readSqliteFixtureState(this.filePath, EMPTY_JOURNAL).entries);
    const backlog = entries.filter(
      (entry) => entry.state !== "accepted" && entry.state !== "terminal-failed",
    );
    const oldest = backlog.reduce<number | null>(
      (current, entry) =>
        current === null
          ? Date.parse(entry.createdAt)
          : Math.min(current, Date.parse(entry.createdAt)),
      null,
    );
    return {
      backlogCount: backlog.length,
      oldestPendingAgeMs: oldest === null ? null : Math.max(0, now.getTime() - oldest),
      retryCount: entries.reduce((total, entry) => total + entry.retryCount, 0),
      terminalFailureCount: entries.filter((entry) => entry.state === "terminal-failed").length,
    };
  }
}

function normalizeEvent(event: BillableUsageEvent): BillableUsageEvent {
  return {
    ...event,
    dimensions: Object.freeze(
      Object.fromEntries(
        Object.entries(event.dimensions).sort(([left], [right]) => left.localeCompare(right)),
      ),
    ),
  };
}

function stableEvent(event: BillableUsageEvent): string {
  return JSON.stringify(normalizeEvent(event));
}

function toEntry(entry: StoredEntry): BillableUsageJournalEntry {
  return {
    ...entry,
    event: normalizeEvent(entry.event),
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
    leaseExpiresAt: entry.leaseExpiresAt ? new Date(entry.leaseExpiresAt) : undefined,
    retryAt: entry.retryAt ? new Date(entry.retryAt) : undefined,
    acceptedAt: entry.acceptedAt ? new Date(entry.acceptedAt) : undefined,
    deliverableAt: entry.deliverableAt ? new Date(entry.deliverableAt) : undefined,
    failure: entry.failure ? { ...entry.failure } : undefined,
  };
}

function requirePending(journal: StoredJournal, eventId: string, transition: string): StoredEntry {
  const entry = journal.entries[eventId];
  if (!entry || entry.state !== "pending") {
    throw new MeteringTransitionProblem(
      transition,
      entry ? `STATUS:${entry.state}` : "MISSING",
      eventId,
    );
  }
  return entry;
}

function requireClaim(
  journal: StoredJournal,
  claim: BillableUsageClaim,
  transition: string,
  now: Date,
): StoredEntry {
  const entry = journal.entries[claim.event.eventId];
  const valid =
    entry?.state === "delivering" &&
    entry.ownerId === claim.ownerId &&
    entry.fencingToken === claim.fencingToken &&
    Boolean(entry.leaseExpiresAt && Date.parse(entry.leaseExpiresAt) > now.getTime());
  if (!entry || !valid) {
    throw new MeteringTransitionProblem(transition, "STALE_CLAIM", claim.event.eventId);
  }
  return entry;
}

function isClaimable(entry: StoredEntry, now: Date): boolean {
  if (entry.state === "pending") {
    return Boolean(entry.deliverableAt && Date.parse(entry.deliverableAt) <= now.getTime());
  }
  if (entry.state === "retryable-failed") {
    return !entry.retryAt || Date.parse(entry.retryAt) <= now.getTime();
  }
  return (
    entry.state === "delivering" &&
    Boolean(entry.leaseExpiresAt && Date.parse(entry.leaseExpiresAt) <= now.getTime())
  );
}

function clearClaim(entry: StoredEntry, preserveRetryAt = false): void {
  delete entry.ownerId;
  delete entry.fencingToken;
  delete entry.leaseExpiresAt;
  if (!preserveRetryAt) delete entry.retryAt;
}
