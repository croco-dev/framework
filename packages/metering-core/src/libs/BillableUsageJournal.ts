import { MeteringTransitionProblem } from "./problems/MeteringTransitionProblem";
import type { MeterAggregation } from "./MeterRef";

export type BillableUsageEvent = {
  readonly eventId: string;
  readonly tenantId: string;
  readonly meterId: string;
  readonly aggregation: MeterAggregation;
  readonly unit: string;
  readonly value: number;
  readonly dimensions: Readonly<Record<string, string | number | boolean>>;
};

export type BillableUsageDeliveryState =
  | "pending"
  | "delivering"
  | "accepted"
  | "retryable-failed"
  | "terminal-failed";

export type BillableUsageFailure = {
  readonly code: string;
  readonly message: string;
};

export type BillableUsageJournalEntry = {
  readonly event: BillableUsageEvent;
  readonly state: BillableUsageDeliveryState;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly retryCount: number;
  readonly ownerId?: string;
  readonly fencingToken?: number;
  readonly leaseExpiresAt?: Date;
  readonly retryAt?: Date;
  readonly failure?: BillableUsageFailure;
  readonly acceptedAt?: Date;
  readonly deliverableAt?: Date;
};

export type BillableUsageClaim = BillableUsageJournalEntry & {
  readonly state: "delivering";
  readonly ownerId: string;
  readonly fencingToken: number;
  readonly leaseExpiresAt: Date;
};

export type BillableUsageAppendResult = {
  readonly outcome: "appended" | "duplicate";
  readonly entry: BillableUsageJournalEntry;
};

export type BillableUsageClaimOptions = {
  readonly ownerId: string;
  readonly leaseDurationMs: number;
  readonly now?: Date;
};

export type BillableUsageJournalDiagnostics = {
  readonly backlogCount: number;
  readonly oldestPendingAgeMs: number | null;
  readonly retryCount: number;
  readonly terminalFailureCount: number;
};

/**
 * Durable provider-delivery journal contract.
 *
 * Implementations must make every transition atomic. Implementations whose `durability` is `"persistent"` must
 * persist entries independently of the request process.
 * A claim is valid only before its server-time lease expires, for its owner, and with its monotonically increasing
 * fencing token.
 */
export interface BillableUsageJournal {
  readonly durability: "persistent" | "volatile";
  append(event: BillableUsageEvent, now?: Date): Promise<BillableUsageAppendResult>;
  markDeliverable(eventId: string, now?: Date): Promise<BillableUsageJournalEntry>;
  markUndeliverable(
    eventId: string,
    failure: BillableUsageFailure,
    now?: Date,
  ): Promise<BillableUsageJournalEntry>;
  claimNext(options: BillableUsageClaimOptions): Promise<BillableUsageClaim | null>;
  markAccepted(claim: BillableUsageClaim, now?: Date): Promise<BillableUsageJournalEntry>;
  markRetryableFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    retryAt: Date,
    now?: Date,
  ): Promise<BillableUsageJournalEntry>;
  markTerminalFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    now?: Date,
  ): Promise<BillableUsageJournalEntry>;
  get(eventId: string): Promise<BillableUsageJournalEntry | null>;
  getDiagnostics(now?: Date): Promise<BillableUsageJournalDiagnostics>;
}

type MutableEntry = {
  event: BillableUsageEvent;
  state: BillableUsageDeliveryState;
  createdAt: Date;
  updatedAt: Date;
  retryCount: number;
  ownerId?: string;
  fencingToken?: number;
  leaseExpiresAt?: Date;
  retryAt?: Date;
  failure?: BillableUsageFailure;
  acceptedAt?: Date;
  deliverableAt?: Date;
};

function compareKeys(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function copyEvent(event: BillableUsageEvent): BillableUsageEvent {
  return Object.freeze({
    eventId: event.eventId,
    tenantId: event.tenantId,
    meterId: event.meterId,
    aggregation: event.aggregation,
    unit: event.unit,
    value: event.value,
    dimensions: Object.freeze(
      Object.fromEntries(
        Object.entries(event.dimensions).sort(([left], [right]) => compareKeys(left, right)),
      ),
    ),
  });
}

function copyEntry(entry: MutableEntry): BillableUsageJournalEntry {
  return {
    ...entry,
    event: entry.event,
    createdAt: new Date(entry.createdAt),
    updatedAt: new Date(entry.updatedAt),
    leaseExpiresAt: entry.leaseExpiresAt && new Date(entry.leaseExpiresAt),
    retryAt: entry.retryAt && new Date(entry.retryAt),
    acceptedAt: entry.acceptedAt && new Date(entry.acceptedAt),
    deliverableAt: entry.deliverableAt && new Date(entry.deliverableAt),
    failure: entry.failure && { ...entry.failure },
  };
}

function stableEvent(event: BillableUsageEvent): string {
  return JSON.stringify(copyEvent(event));
}

/**
 * Reference journal for tests and single-process development.
 * Production adapters must implement BillableUsageJournal with persistent storage.
 */
export class InMemoryBillableUsageJournal implements BillableUsageJournal {
  readonly durability = "volatile" as const;
  private readonly entries = new Map<string, MutableEntry>();
  private nextFencingToken = 1;

  async append(event: BillableUsageEvent, now = new Date()): Promise<BillableUsageAppendResult> {
    const normalized = copyEvent(event);
    const existing = this.entries.get(normalized.eventId);
    if (existing) {
      if (stableEvent(existing.event) !== stableEvent(normalized)) {
        throw new MeteringTransitionProblem(
          "append-billable-usage",
          "EVENT_CONFLICT",
          event.eventId,
        );
      }
      return { outcome: "duplicate", entry: copyEntry(existing) };
    }

    const entry: MutableEntry = {
      event: normalized,
      state: "pending",
      createdAt: new Date(now),
      updatedAt: new Date(now),
      retryCount: 0,
    };
    this.entries.set(normalized.eventId, entry);
    return { outcome: "appended", entry: copyEntry(entry) };
  }

  async claimNext(options: BillableUsageClaimOptions): Promise<BillableUsageClaim | null> {
    const now = options.now ?? new Date();
    if (!Number.isFinite(options.leaseDurationMs) || options.leaseDurationMs <= 0) {
      throw new MeteringTransitionProblem("claim-billable-usage", "INVALID_LEASE", options.ownerId);
    }

    const candidate = [...this.entries.values()]
      .filter((entry) => this.isClaimable(entry, now))
      .sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime())[0];
    if (!candidate) {
      return null;
    }

    const fencingToken = this.nextFencingToken++;
    const leaseExpiresAt = new Date(now.getTime() + options.leaseDurationMs);
    candidate.state = "delivering";
    candidate.ownerId = options.ownerId;
    candidate.fencingToken = fencingToken;
    candidate.leaseExpiresAt = leaseExpiresAt;
    candidate.retryAt = undefined;
    candidate.updatedAt = new Date(now);
    return {
      ...copyEntry(candidate),
      state: "delivering",
      ownerId: options.ownerId,
      fencingToken,
      leaseExpiresAt: new Date(leaseExpiresAt),
    };
  }

  async markDeliverable(eventId: string, now = new Date()): Promise<BillableUsageJournalEntry> {
    const entry = this.requirePending(eventId, "activate-billable-usage");
    entry.deliverableAt = new Date(now);
    entry.updatedAt = new Date(now);
    return copyEntry(entry);
  }

  async markUndeliverable(
    eventId: string,
    failure: BillableUsageFailure,
    now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    const entry = this.requirePending(eventId, "reject-pending-billable-usage");
    entry.state = "terminal-failed";
    entry.failure = { ...failure };
    entry.updatedAt = new Date(now);
    return copyEntry(entry);
  }

  async markAccepted(
    claim: BillableUsageClaim,
    now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    const entry = this.requireClaim(claim, "accept-billable-usage", now);
    entry.state = "accepted";
    entry.acceptedAt = new Date(now);
    entry.updatedAt = new Date(now);
    this.clearClaim(entry);
    return copyEntry(entry);
  }

  async markRetryableFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    retryAt: Date,
    now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    const entry = this.requireClaim(claim, "retry-billable-usage", now);
    entry.state = "retryable-failed";
    entry.retryCount += 1;
    entry.failure = { ...failure };
    entry.retryAt = new Date(retryAt);
    entry.updatedAt = new Date(now);
    this.clearClaim(entry, true);
    return copyEntry(entry);
  }

  async markTerminalFailed(
    claim: BillableUsageClaim,
    failure: BillableUsageFailure,
    now = new Date(),
  ): Promise<BillableUsageJournalEntry> {
    const entry = this.requireClaim(claim, "reject-billable-usage", now);
    entry.state = "terminal-failed";
    entry.failure = { ...failure };
    entry.updatedAt = new Date(now);
    this.clearClaim(entry);
    return copyEntry(entry);
  }

  async get(eventId: string): Promise<BillableUsageJournalEntry | null> {
    const entry = this.entries.get(eventId);
    return entry ? copyEntry(entry) : null;
  }

  async getDiagnostics(now = new Date()): Promise<BillableUsageJournalDiagnostics> {
    const backlog = [...this.entries.values()].filter(
      (entry) => entry.state !== "accepted" && entry.state !== "terminal-failed",
    );
    const oldest = backlog.reduce<number | null>(
      (current, entry) =>
        current === null ? entry.createdAt.getTime() : Math.min(current, entry.createdAt.getTime()),
      null,
    );
    return {
      backlogCount: backlog.length,
      oldestPendingAgeMs: oldest === null ? null : Math.max(0, now.getTime() - oldest),
      retryCount: [...this.entries.values()].reduce((total, entry) => total + entry.retryCount, 0),
      terminalFailureCount: [...this.entries.values()].filter(
        (entry) => entry.state === "terminal-failed",
      ).length,
    };
  }

  private isClaimable(entry: MutableEntry, now: Date): boolean {
    if (entry.state === "pending") {
      return Boolean(entry.deliverableAt && entry.deliverableAt.getTime() <= now.getTime());
    }
    if (entry.state === "retryable-failed") {
      return !entry.retryAt || entry.retryAt.getTime() <= now.getTime();
    }
    return (
      entry.state === "delivering" &&
      Boolean(entry.leaseExpiresAt && entry.leaseExpiresAt.getTime() <= now.getTime())
    );
  }

  private requireClaim(claim: BillableUsageClaim, transition: string, now: Date): MutableEntry {
    const entry = this.entries.get(claim.event.eventId);
    const valid =
      entry?.state === "delivering" &&
      entry.ownerId === claim.ownerId &&
      entry.fencingToken === claim.fencingToken &&
      Boolean(entry.leaseExpiresAt && entry.leaseExpiresAt.getTime() > now.getTime());
    if (!entry || !valid) {
      throw new MeteringTransitionProblem(transition, "STALE_CLAIM", claim.event.eventId);
    }
    return entry;
  }

  private requirePending(eventId: string, transition: string): MutableEntry {
    const entry = this.entries.get(eventId);
    if (!entry || entry.state !== "pending") {
      throw new MeteringTransitionProblem(
        transition,
        entry ? `STATUS:${entry.state}` : "MISSING",
        eventId,
      );
    }
    return entry;
  }

  private clearClaim(entry: MutableEntry, preserveRetryAt = false): void {
    entry.ownerId = undefined;
    entry.fencingToken = undefined;
    entry.leaseExpiresAt = undefined;
    if (!preserveRetryAt) {
      entry.retryAt = undefined;
    }
  }
}
