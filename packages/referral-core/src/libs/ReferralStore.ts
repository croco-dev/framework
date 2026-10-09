import { InvalidReferralProgramProblem } from "./problems";
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

function stableSerialize(value: unknown): string {
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

/**
 * Deterministic fingerprint shared by every ReferralStore implementation, so
 * idempotency replays agree across in-memory and PostgreSQL adapters.
 */
export function stableReferralFingerprint(value: unknown): string {
  return stableSerialize(value);
}

/**
 * Semantic fingerprint of an attribution: identical retries replay the same
 * receipt while a different payload under the same logical key is a conflict.
 */
export function attributionFingerprint(attribution: ReferralAttribution): string {
  return stableSerialize({
    linkId: attribution.linkId,
    programId: attribution.programId,
    programVersion: attribution.programVersion,
    familyId: attribution.familyId,
    benefitCycleId: attribution.benefitCycleId,
    referrer: attribution.referrer,
    recipient: attribution.recipient,
    state: attribution.state,
  });
}

/**
 * Transactional referral storage boundary.
 *
 * Implementations must make `transact` atomic: first-valid insertion,
 * subject counting, budget reservation, and benefit intent creation inside
 * one `transact` call observe each other, so concurrent claims serialize
 * instead of crediting two referrers or overspending the budget. Benefit
 * intent status changes are compare-and-set guarded by the expected states.
 */
export interface ReferralTx {
  getProgram(programId: string, version: number): Promise<ReferralProgramDefinition | null>;
  latestProgramVersion(programId: string): Promise<number | null>;
  /**
   * Persists a registered program. The same `(id, version)` with an identical
   * document replays as `{ created: false }`; a different document under the
   * same `(id, version)` is a conflict.
   */
  saveProgram(program: ReferralProgramDefinition): Promise<{ readonly created: boolean }>;
  getLink(linkId: string): Promise<ReferralLink | null>;
  getLinkByTokenHash(tokenHash: string): Promise<ReferralLink | null>;
  /** Persists a link; token hashes are unique. Replays return `{ created: false }`. */
  saveLink(link: ReferralLink): Promise<{ readonly created: boolean; readonly link: ReferralLink }>;
  revokeLink(linkId: string, revokedAt: Date): Promise<ReferralLink>;
  recordClick(linkId: string, occurredAt: Date): Promise<void>;
  listLinks(filter: ListReferralLinksFilter): Promise<readonly ReferralLink[]>;
  countClicksForProgram(programId: string): Promise<number>;
  getAttribution(attributionId: string): Promise<ReferralAttribution | null>;
  /** First-valid lookup: the earliest claimed attribution for a recipient in a family. */
  getFirstAttributionForRecipient(
    familyId: string,
    recipient: ReferralSubject,
  ): Promise<ReferralAttribution | null>;
  listAttributionsForRecipient(
    familyId: string,
    recipient: ReferralSubject,
  ): Promise<readonly ReferralAttribution[]>;
  /**
   * Persists an attribution. A known id with an identical fingerprint replays
   * as `{ created: false }`; a different payload under the same id is a
   * duplicate-claim conflict.
   */
  saveAttribution(
    attribution: ReferralAttribution,
    fingerprint: string,
  ): Promise<{ readonly created: boolean; readonly attribution: ReferralAttribution }>;
  compareAndSetAttribution(
    attributionId: string,
    expected: readonly ReferralAttribution["state"][],
    next: ReferralAttribution,
  ): Promise<ReferralAttribution>;
  getBenefitIntent(intentId: string): Promise<ReferralBenefitIntent | null>;
  getBenefitIntentByLogicalKey(logicalKey: string): Promise<ReferralBenefitIntent | null>;
  listBenefitIntentsForAttribution(
    attributionId: string,
  ): Promise<readonly ReferralBenefitIntent[]>;
  /** Persists a benefit intent; logical keys are unique per side. */
  saveBenefitIntent(
    intent: ReferralBenefitIntent,
  ): Promise<{ readonly created: boolean; readonly intent: ReferralBenefitIntent }>;
  compareAndSetBenefitIntent(
    intentId: string,
    expected: readonly ReferralBenefitIntentStatus[],
    patch: {
      readonly status: ReferralBenefitIntentStatus;
      readonly receipt?: string;
      readonly reason?: string;
      readonly accountRef?: string;
    },
    now: Date,
  ): Promise<ReferralBenefitIntent>;
  addBudgetReservation(programId: string, version: number, amount: string): Promise<void>;
  releaseBudgetReservation(programId: string, version: number, amount: string): Promise<void>;
  readBudgetReserved(programId: string, version: number): Promise<string>;
  countSubjectReceipts(
    familyId: string,
    benefitCycleId: string,
    subject: ReferralSubject,
    states: readonly ReferralAttribution["state"][],
  ): Promise<number>;
  listAttributions(filter: ListAttributionsFilter): Promise<readonly ReferralAttribution[]>;
  listBenefitIntents(filter: ListBenefitIntentsFilter): Promise<readonly ReferralBenefitIntent[]>;
  countClicks(linkId: string): Promise<number>;
  recordAudit(entry: ReferralAuditEntry): Promise<void>;
}

export interface ReferralStore {
  transact<T>(work: (tx: ReferralTx) => Promise<T>): Promise<T>;
  getProgram(programId: string, version: number): Promise<ReferralProgramDefinition | null>;
  latestProgramVersion(programId: string): Promise<number | null>;
  getLink(linkId: string): Promise<ReferralLink | null>;
  getLinkByTokenHash(tokenHash: string): Promise<ReferralLink | null>;
  getAttribution(attributionId: string): Promise<ReferralAttribution | null>;
  getBenefitIntent(intentId: string): Promise<ReferralBenefitIntent | null>;
  listAttributions(filter: ListAttributionsFilter): Promise<readonly ReferralAttribution[]>;
  listBenefitIntents(filter: ListBenefitIntentsFilter): Promise<readonly ReferralBenefitIntent[]>;
}

export function assertReferralLimit(limit: number | undefined, fallback: number): number {
  const resolved = limit ?? fallback;
  if (!Number.isInteger(resolved) || resolved < 1 || resolved > 1000) {
    throw new InvalidReferralProgramProblem("list limit must be an integer between 1 and 1000");
  }
  return resolved;
}
