import { assertChallengeScope } from "./ChallengeContracts";
import type {
  Challenge,
  ChallengeMember,
  ChallengeContribution,
  ChallengeReceipt,
  ChallengeEvidenceAttempt,
  ChallengeCompletion,
  ChallengeScope,
  ChallengeStore,
  ChallengeTransaction,
} from "./ChallengeContracts";
type Aggregate = {
  challenge: Challenge | null;
  members: ChallengeMember[];
  contributions: ChallengeContribution[];
  receipts: ChallengeReceipt[];
  evidenceAttempts: ChallengeEvidenceAttempt[];
  completion: ChallengeCompletion | null;
  erasedEventIds: string[];
  erasedSubjectHashes: string[];
};
/** Development/test adapter. Each transaction commits a detached snapshot or rolls back entirely. */
export class InMemoryChallengeStore implements ChallengeStore {
  private readonly aggregates = new Map<string, Aggregate>();
  private readonly locks = new Map<string, Promise<void>>();
  async transact<T>(
    scope: ChallengeScope,
    challengeId: string,
    operation: (transaction: ChallengeTransaction) => Promise<T>,
  ): Promise<T> {
    assertChallengeScope(scope, challengeId);
    const key = JSON.stringify([scope.app, scope.environment, scope.tenantId, challengeId]);
    const preceding = this.locks.get(key) ?? Promise.resolve();
    let release = () => {};
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, lock);
    await preceding;
    try {
      const state = structuredClone(
        this.aggregates.get(key) ?? {
          challenge: null,
          members: [],
          contributions: [],
          receipts: [],
          evidenceAttempts: [],
          completion: null,
          erasedEventIds: [],
          erasedSubjectHashes: [],
        },
      );
      const transaction: ChallengeTransaction = {
        get challenge() {
          return structuredClone(state.challenge);
        },
        get members() {
          return structuredClone(state.members);
        },
        get contributions() {
          return structuredClone(state.contributions);
        },
        get evidenceAttempts() {
          return structuredClone(state.evidenceAttempts);
        },
        saveEvidenceAttempt: (value) => save(state.evidenceAttempts, value, (item) => item.id),
        get receipts() {
          return structuredClone(state.receipts);
        },
        get completion() {
          return structuredClone(state.completion);
        },
        get erasedEventIds() {
          return [...state.erasedEventIds];
        },
        get erasedSubjectHashes() {
          return [...state.erasedSubjectHashes];
        },
        saveChallenge: (value) => {
          state.challenge = structuredClone(value);
        },
        saveMember: (value) => save(state.members, value, (item) => item.subjectId),
        saveContribution: (value) => save(state.contributions, value, (item) => item.eventId),
        saveReceipt: (value) => save(state.receipts, value, (item) => item.idempotencyKey),
        saveCompletion: (value) => {
          state.completion = structuredClone(value);
        },
        eraseSubject: (subjectId, subjectHash) => {
          state.erasedSubjectHashes.push(subjectHash);
          state.erasedEventIds.push(
            ...state.contributions
              .filter((item) => item.subjectId === subjectId)
              .map((item) => item.eventId),
          );
          state.contributions = state.contributions.filter((item) => item.subjectId !== subjectId);
          state.evidenceAttempts = state.evidenceAttempts.filter(
            (item) => item.subjectId !== subjectId,
          );
          state.members = state.members.filter((item) => item.subjectId !== subjectId);
          state.receipts = state.receipts.map((item) =>
            item.subjectHash === subjectHash || item.actor === subjectId
              ? { ...item, subjectHash: null, actor: "", reason: "" }
              : item,
          );
        },
      };
      const result = structuredClone(await operation(transaction));
      this.aggregates.set(key, structuredClone(state));
      return result;
    } finally {
      release();
      if (this.locks.get(key) === lock) this.locks.delete(key);
    }
  }
}
function save<T>(items: T[], value: T, key: (item: T) => string): void {
  const index = items.findIndex((item) => key(item) === key(value));
  if (index < 0) items.push(structuredClone(value));
  else items[index] = structuredClone(value);
}
