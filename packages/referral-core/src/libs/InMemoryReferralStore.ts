import { addReferralAmounts, compareReferralAmounts, subtractReferralAmounts } from "./amounts";
import {
  ReferralAttributionNotFoundProblem,
  ReferralAttributionStateConflictProblem,
  ReferralBudgetExhaustedProblem,
  ReferralDuplicateClaimProblem,
  ReferralProgramConflictProblem,
  ReferralProgramNotFoundProblem,
} from "./problems";
import { assertReferralLimit, stableReferralFingerprint } from "./ReferralStore";
import type { ReferralStore, ReferralTx } from "./ReferralStore";
import type {
  ListAttributionsFilter,
  ListBenefitIntentsFilter,
  ListReferralLinksFilter,
  ReferralAttribution,
  ReferralAuditEntry,
  ReferralBenefitIntent,
  ReferralBenefitIntentStatus,
  ReferralLink,
  ReferralProgramDefinition,
  ReferralSubject,
} from "./types";

function cloneDate(value: Date): Date {
  return new Date(value.getTime());
}

function cloneSubject(subject: ReferralSubject): ReferralSubject {
  return { ...subject };
}

function cloneUnknown<T>(value: T): T {
  if (Array.isArray(value)) return value.map(cloneUnknown) as unknown as T;
  if (value instanceof Date) return cloneDate(value) as unknown as T;
  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
      result[key] = cloneUnknown(entry);
    }
    return result as T;
  }
  return value;
}

function cloneProgram(program: ReferralProgramDefinition): ReferralProgramDefinition {
  return {
    ...program,
    referrerBenefit: cloneUnknown(program.referrerBenefit),
    recipientBenefit: cloneUnknown(program.recipientBenefit),
    startsAt: cloneDate(program.startsAt),
    endsAt: cloneDate(program.endsAt),
    registeredAt: cloneDate(program.registeredAt),
  };
}

function cloneLink(link: ReferralLink): ReferralLink {
  return {
    ...link,
    referrer: cloneSubject(link.referrer),
    createdAt: cloneDate(link.createdAt),
    expiresAt: cloneDate(link.expiresAt),
    revokedAt: link.revokedAt ? cloneDate(link.revokedAt) : undefined,
  };
}

function cloneAttribution(attribution: ReferralAttribution): ReferralAttribution {
  return {
    ...attribution,
    scope: { ...attribution.scope },
    referrer: cloneSubject(attribution.referrer),
    recipient: attribution.recipient ? cloneSubject(attribution.recipient) : undefined,
    claimedAt: cloneDate(attribution.claimedAt),
    expiresAt: cloneDate(attribution.expiresAt),
    qualification: attribution.qualification
      ? {
          ...attribution.qualification,
          qualifiedAt: cloneDate(attribution.qualification.qualifiedAt),
        }
      : undefined,
    createdAt: cloneDate(attribution.createdAt),
    updatedAt: cloneDate(attribution.updatedAt),
  };
}

function cloneIntent(intent: ReferralBenefitIntent): ReferralBenefitIntent {
  return {
    ...intent,
    subject: cloneSubject(intent.subject),
    benefit: cloneUnknown(intent.benefit),
    returnOperation: intent.returnOperation ? { ...intent.returnOperation } : undefined,
    createdAt: cloneDate(intent.createdAt),
    updatedAt: cloneDate(intent.updatedAt),
  };
}

function matchesSubject(candidate: ReferralSubject, filter: ReferralSubject): boolean {
  return (
    candidate.appId === filter.appId &&
    candidate.environment === filter.environment &&
    candidate.tenantId === filter.tenantId &&
    candidate.kind === filter.kind &&
    candidate.id === filter.id
  );
}

type ProgramRecord = {
  program: ReferralProgramDefinition;
  fingerprint: string;
  reserved: string;
};

/**
 * Single-process store with serialized, isolated transactions. Each callback
 * works on a deep snapshot; only a successful callback publishes its state.
 * Reads on the store see committed state while the callback is running.
 */
export class InMemoryReferralStore implements ReferralStore, ReferralTx {
  private state = {
    programs: new Map<string, ProgramRecord>(),
    links: new Map<string, ReferralLink>(),
    linksByTokenHash: new Map<string, string>(),
    clicks: new Map<string, number>(),
    attributions: new Map<string, ReferralAttribution>(),
    attributionFingerprints: new Map<string, string>(),
    intents: new Map<string, ReferralBenefitIntent>(),
    intentsByLogicalKey: new Map<string, string>(),
    audits: [] as ReferralAuditEntry[],
  };
  private queue: Promise<unknown> = Promise.resolve();

  private copyState() {
    return {
      programs: new Map(
        [...this.state.programs].map(([key, record]) => [
          key,
          {
            ...record,
            program: cloneProgram(record.program),
          },
        ]),
      ),
      links: new Map([...this.state.links].map(([key, link]) => [key, cloneLink(link)])),
      linksByTokenHash: new Map(this.state.linksByTokenHash),
      clicks: new Map(this.state.clicks),
      attributions: new Map(
        [...this.state.attributions].map(([key, attribution]) => [
          key,
          cloneAttribution(attribution),
        ]),
      ),
      attributionFingerprints: new Map(this.state.attributionFingerprints),
      intents: new Map([...this.state.intents].map(([key, intent]) => [key, cloneIntent(intent)])),
      intentsByLogicalKey: new Map(this.state.intentsByLogicalKey),
      audits: this.state.audits.map((entry) => ({
        ...entry,
        recordedAt: cloneDate(entry.recordedAt),
      })),
    };
  }

  private static programKey(programId: string, version: number): string {
    return `${programId}@${version}`;
  }

  async transact<T>(work: (tx: ReferralTx) => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const staged = new InMemoryReferralStore();
      staged.state = this.copyState();
      const result = await work(staged);
      // Copy again so a retained transaction handle cannot mutate committed state.
      this.state = staged.copyState();
      return result;
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  async getProgram(programId: string, version: number): Promise<ReferralProgramDefinition | null> {
    const record = this.state.programs.get(InMemoryReferralStore.programKey(programId, version));
    return record ? cloneProgram(record.program) : null;
  }

  async latestProgramVersion(programId: string): Promise<number | null> {
    let latest: number | null = null;
    for (const record of this.state.programs.values()) {
      if (record.program.id === programId && (latest === null || record.program.version > latest)) {
        latest = record.program.version;
      }
    }
    return latest;
  }

  async saveProgram(program: ReferralProgramDefinition): Promise<{ readonly created: boolean }> {
    const key = InMemoryReferralStore.programKey(program.id, program.version);
    const fingerprint = stableReferralFingerprint(program);
    const existing = this.state.programs.get(key);
    if (existing) {
      if (existing.fingerprint !== fingerprint) {
        throw new ReferralProgramConflictProblem(program.id, program.version);
      }
      return { created: false };
    }
    this.state.programs.set(key, { program: cloneProgram(program), fingerprint, reserved: "0" });
    return { created: true };
  }

  async getLink(linkId: string): Promise<ReferralLink | null> {
    const link = this.state.links.get(linkId);
    return link ? cloneLink(link) : null;
  }

  async getLinkByTokenHash(tokenHash: string): Promise<ReferralLink | null> {
    const linkId = this.state.linksByTokenHash.get(tokenHash);
    if (!linkId) return null;
    return this.getLink(linkId);
  }

  async saveLink(
    link: ReferralLink,
  ): Promise<{ readonly created: boolean; readonly link: ReferralLink }> {
    const byHash = this.state.linksByTokenHash.get(link.tokenHash);
    if (byHash && byHash !== link.id) {
      throw new ReferralDuplicateClaimProblem(link.referrer.id);
    }
    const existing = this.state.links.get(link.id);
    if (existing) {
      if (existing.tokenHash !== link.tokenHash) {
        throw new ReferralDuplicateClaimProblem(link.referrer.id);
      }
      return { created: false, link: cloneLink(existing) };
    }
    this.state.links.set(link.id, cloneLink(link));
    this.state.linksByTokenHash.set(link.tokenHash, link.id);
    return { created: true, link: cloneLink(link) };
  }

  async revokeLink(linkId: string, revokedAt: Date): Promise<ReferralLink> {
    const stored = this.state.links.get(linkId);
    if (!stored) throw new ReferralAttributionNotFoundProblem(linkId);
    const revoked: ReferralLink = {
      ...cloneLink(stored),
      revokedAt: new Date(revokedAt.getTime()),
    };
    this.state.links.set(linkId, revoked);
    return cloneLink(revoked);
  }

  async recordClick(linkId: string, occurredAt: Date): Promise<void> {
    void occurredAt;
    this.state.clicks.set(linkId, (this.state.clicks.get(linkId) ?? 0) + 1);
  }

  async listLinks(filter: ListReferralLinksFilter): Promise<readonly ReferralLink[]> {
    const limit = assertReferralLimit(filter.limit, 100);
    const result: ReferralLink[] = [];
    for (const link of this.state.links.values()) {
      if (filter.programId !== undefined && link.programId !== filter.programId) continue;
      if (filter.familyId !== undefined && link.familyId !== filter.familyId) continue;
      if (filter.benefitCycleId !== undefined && link.benefitCycleId !== filter.benefitCycleId) {
        continue;
      }
      if (filter.referrer !== undefined && !matchesSubject(link.referrer, filter.referrer))
        continue;
      result.push(cloneLink(link));
      if (result.length >= limit) break;
    }
    return result;
  }

  async countClicksForProgram(programId: string): Promise<number> {
    let total = 0;
    for (const [linkId, count] of this.state.clicks) {
      const link = this.state.links.get(linkId);
      if (link && link.programId === programId) total += count;
    }
    return total;
  }

  async getAttribution(attributionId: string): Promise<ReferralAttribution | null> {
    const attribution = this.state.attributions.get(attributionId);
    return attribution ? cloneAttribution(attribution) : null;
  }

  async getFirstAttributionForRecipient(
    familyId: string,
    recipient: ReferralSubject,
  ): Promise<ReferralAttribution | null> {
    const matches = await this.listAttributionsForRecipient(familyId, recipient);
    return matches[0] ?? null;
  }

  async listAttributionsForRecipient(
    familyId: string,
    recipient: ReferralSubject,
  ): Promise<readonly ReferralAttribution[]> {
    const matches: ReferralAttribution[] = [];
    for (const attribution of this.state.attributions.values()) {
      if (attribution.familyId !== familyId || !attribution.recipient) continue;
      if (!matchesSubject(attribution.recipient, recipient)) continue;
      if (attribution.state === "held" && attribution.holdReason === "duplicate-claim") continue;
      matches.push(cloneAttribution(attribution));
    }
    matches.sort(
      (left, right) =>
        left.claimedAt.getTime() - right.claimedAt.getTime() || left.id.localeCompare(right.id),
    );
    return matches;
  }

  async saveAttribution(
    attribution: ReferralAttribution,
    fingerprint: string,
  ): Promise<{ readonly created: boolean; readonly attribution: ReferralAttribution }> {
    const existing = this.state.attributions.get(attribution.id);
    if (existing) {
      if (this.state.attributionFingerprints.get(attribution.id) !== fingerprint) {
        throw new ReferralDuplicateClaimProblem(attribution.recipient?.id ?? attribution.id);
      }
      return { created: false, attribution: cloneAttribution(existing) };
    }
    this.state.attributions.set(attribution.id, cloneAttribution(attribution));
    this.state.attributionFingerprints.set(attribution.id, fingerprint);
    return { created: true, attribution: cloneAttribution(attribution) };
  }

  async compareAndSetAttribution(
    attributionId: string,
    expected: readonly ReferralAttribution["state"][],
    next: ReferralAttribution,
  ): Promise<ReferralAttribution> {
    const stored = this.state.attributions.get(attributionId);
    if (!stored) throw new ReferralAttributionNotFoundProblem(attributionId);
    if (!expected.includes(stored.state)) {
      throw new ReferralAttributionStateConflictProblem(
        attributionId,
        stored.state,
        `expected one of ${expected.join(", ")}`,
      );
    }
    this.state.attributions.set(attributionId, cloneAttribution(next));
    return cloneAttribution(next);
  }

  async getBenefitIntent(intentId: string): Promise<ReferralBenefitIntent | null> {
    const intent = this.state.intents.get(intentId);
    return intent ? cloneIntent(intent) : null;
  }

  async getBenefitIntentByLogicalKey(logicalKey: string): Promise<ReferralBenefitIntent | null> {
    const intentId = this.state.intentsByLogicalKey.get(logicalKey);
    if (!intentId) return null;
    return this.getBenefitIntent(intentId);
  }

  async listBenefitIntentsForAttribution(
    attributionId: string,
  ): Promise<readonly ReferralBenefitIntent[]> {
    const result: ReferralBenefitIntent[] = [];
    for (const intent of this.state.intents.values()) {
      if (intent.attributionId === attributionId) result.push(cloneIntent(intent));
    }
    result.sort((left, right) => left.side.localeCompare(right.side));
    return result;
  }

  async saveBenefitIntent(
    intent: ReferralBenefitIntent,
  ): Promise<{ readonly created: boolean; readonly intent: ReferralBenefitIntent }> {
    const byKey = this.state.intentsByLogicalKey.get(intent.logicalKey);
    if (byKey) {
      const stored = this.state.intents.get(byKey);
      if (!stored) throw new ReferralDuplicateClaimProblem(intent.logicalKey);
      return { created: false, intent: cloneIntent(stored) };
    }
    if (this.state.intents.has(intent.id)) {
      throw new ReferralDuplicateClaimProblem(intent.logicalKey);
    }
    this.state.intents.set(intent.id, cloneIntent(intent));
    this.state.intentsByLogicalKey.set(intent.logicalKey, intent.id);
    return { created: true, intent: cloneIntent(intent) };
  }

  async compareAndSetBenefitIntent(
    intentId: string,
    expected: readonly ReferralBenefitIntentStatus[],
    patch: {
      readonly status: ReferralBenefitIntentStatus;
      readonly receipt?: string;
      readonly reason?: string;
      readonly accountRef?: string;
      readonly fulfillmentAttempt?: number;
      readonly returnOperation?: ReferralBenefitIntent["returnOperation"];
    },
    now: Date,
    expectedAttempt?: number,
  ): Promise<ReferralBenefitIntent> {
    const stored = this.state.intents.get(intentId);
    if (!stored) throw new ReferralAttributionNotFoundProblem(intentId);
    if (
      !expected.includes(stored.status) ||
      (expectedAttempt !== undefined && (stored.fulfillmentAttempt ?? 0) !== expectedAttempt)
    ) {
      throw new ReferralAttributionStateConflictProblem(
        intentId,
        stored.status,
        `expected one of ${expected.join(", ")}${expectedAttempt === undefined ? "" : ` with fulfillment attempt ${expectedAttempt}`}`,
      );
    }
    const updated: ReferralBenefitIntent = {
      ...cloneIntent(stored),
      status: patch.status,
      fulfillmentAttempt: patch.fulfillmentAttempt ?? stored.fulfillmentAttempt,
      returnOperation: patch.returnOperation
        ? { ...patch.returnOperation }
        : stored.returnOperation,
      receipt: patch.receipt ?? stored.receipt,
      reason: patch.reason,
      accountRef: patch.accountRef ?? stored.accountRef,
      updatedAt: new Date(now.getTime()),
    };
    this.state.intents.set(intentId, updated);
    return cloneIntent(updated);
  }

  async addBudgetReservation(programId: string, version: number, amount: string): Promise<void> {
    const record = this.state.programs.get(InMemoryReferralStore.programKey(programId, version));
    if (!record) throw new ReferralProgramNotFoundProblem(programId, version);
    const next = addReferralAmounts(record.reserved, amount);
    if (compareReferralAmounts(next, record.program.budgetTotal) > 0) {
      throw new ReferralBudgetExhaustedProblem(programId, version);
    }
    record.reserved = next;
  }

  async releaseBudgetReservation(
    programId: string,
    version: number,
    amount: string,
  ): Promise<void> {
    const record = this.state.programs.get(InMemoryReferralStore.programKey(programId, version));
    if (!record) throw new ReferralProgramNotFoundProblem(programId, version);
    record.reserved =
      compareReferralAmounts(amount, record.reserved) >= 0
        ? "0"
        : subtractReferralAmounts(record.reserved, amount);
  }

  async readBudgetReserved(programId: string, version: number): Promise<string> {
    const record = this.state.programs.get(InMemoryReferralStore.programKey(programId, version));
    if (!record) throw new ReferralProgramNotFoundProblem(programId, version);
    return record.reserved;
  }

  async countSubjectReceipts(
    familyId: string,
    benefitCycleId: string,
    subject: ReferralSubject,
    states: readonly ReferralAttribution["state"][],
  ): Promise<number> {
    let count = 0;
    for (const attribution of this.state.attributions.values()) {
      if (attribution.familyId !== familyId || attribution.benefitCycleId !== benefitCycleId) {
        continue;
      }
      if (!states.includes(attribution.state)) continue;
      const parties = [attribution.referrer, attribution.recipient].filter(
        (entry): entry is ReferralSubject => entry !== undefined,
      );
      if (parties.some((party) => matchesSubject(party, subject))) count += 1;
    }
    return count;
  }

  async listAttributions(filter: ListAttributionsFilter): Promise<readonly ReferralAttribution[]> {
    const limit = assertReferralLimit(filter.limit, 100);
    const result: ReferralAttribution[] = [];
    for (const attribution of this.state.attributions.values()) {
      if (filter.programId !== undefined && attribution.programId !== filter.programId) continue;
      if (filter.familyId !== undefined && attribution.familyId !== filter.familyId) continue;
      if (
        filter.benefitCycleId !== undefined &&
        attribution.benefitCycleId !== filter.benefitCycleId
      ) {
        continue;
      }
      if (filter.referrer !== undefined && !matchesSubject(attribution.referrer, filter.referrer)) {
        continue;
      }
      if (
        filter.recipient !== undefined &&
        (!attribution.recipient || !matchesSubject(attribution.recipient, filter.recipient))
      ) {
        continue;
      }
      if (filter.states !== undefined && !filter.states.includes(attribution.state)) continue;
      result.push(cloneAttribution(attribution));
      if (result.length >= limit) break;
    }
    return result;
  }

  async listBenefitIntents(
    filter: ListBenefitIntentsFilter,
  ): Promise<readonly ReferralBenefitIntent[]> {
    const limit = assertReferralLimit(filter.limit, 100);
    const result: ReferralBenefitIntent[] = [];
    for (const intent of this.state.intents.values()) {
      if (filter.attributionId !== undefined && intent.attributionId !== filter.attributionId) {
        continue;
      }
      if (filter.side !== undefined && intent.side !== filter.side) continue;
      if (filter.statuses !== undefined && !filter.statuses.includes(intent.status)) continue;
      result.push(cloneIntent(intent));
      if (result.length >= limit) break;
    }
    return result;
  }

  async countClicks(linkId: string): Promise<number> {
    return this.state.clicks.get(linkId) ?? 0;
  }

  async recordAudit(entry: ReferralAuditEntry): Promise<void> {
    this.state.audits.push({ ...entry, recordedAt: new Date(entry.recordedAt.getTime()) });
  }

  /** Test and console support: read-only audit trail in insertion order. */
  async listAudits(): Promise<readonly ReferralAuditEntry[]> {
    return this.state.audits.map((entry) => ({
      ...entry,
      recordedAt: new Date(entry.recordedAt.getTime()),
    }));
  }
}
