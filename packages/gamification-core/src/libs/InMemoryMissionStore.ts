import { MissionConflictProblem, missionKey } from "./MissionContracts";
import type {
  MissionAggregate,
  MissionAggregateKey,
  MissionPublication,
  MissionScope,
  MissionStore,
} from "./types";

/** Unit-test adapter. Use a durable atomic store for deployed services. */
export class InMemoryMissionStore implements MissionStore {
  private aggregates = new Map<string, MissionAggregate>();
  private publications: MissionPublication[] = [];
  async transaction<T>(
    key: MissionAggregateKey,
    operation: (current: MissionAggregate | undefined) => {
      aggregate: MissionAggregate;
      result: T;
    },
  ): Promise<T> {
    const identity = missionKey(key);
    const current = this.aggregates.get(identity);
    const result = operation(current ? structuredClone(current) : undefined);
    for (const other of this.aggregates.values()) {
      if (
        missionKey(other.key) === identity ||
        missionKey(other.key.scope) !== missionKey(key.scope) ||
        other.key.subjectId !== key.subjectId ||
        other.key.missionId !== key.missionId
      )
        continue;
      if (
        Object.keys(result.aggregate.receipts).some((eventId) =>
          Object.hasOwn(other.receipts, eventId),
        )
      )
        throw new MissionConflictProblem("Evidence already belongs to another instance");
    }
    this.aggregates.set(identity, structuredClone(result.aggregate));
    return structuredClone(result.result);
  }
  async read(key: MissionAggregateKey): Promise<MissionAggregate | undefined> {
    const value = this.aggregates.get(missionKey(key));
    return value ? structuredClone(value) : undefined;
  }
  async publish(publication: MissionPublication): Promise<MissionPublication> {
    const existing = this.publications.filter(
      (item) =>
        missionKey(item.scope) === missionKey(publication.scope) &&
        item.definition.id === publication.definition.id,
    );
    const replay = existing.find((item) => item.idempotencyKey === publication.idempotencyKey);
    if (replay) {
      if (missionKey(replay) !== missionKey(publication))
        throw new MissionConflictProblem("Publication idempotency conflict");
      return structuredClone(replay);
    }
    if (
      existing.some((item) => item.definition.version === publication.definition.version) ||
      publication.revision !== existing.length + 1
    )
      throw new MissionConflictProblem("Publication version or revision conflict");
    this.publications.push(structuredClone(publication));
    return structuredClone(publication);
  }
  async getDefinition(
    scope: MissionScope,
    missionId: string,
    version: number,
  ): Promise<MissionPublication | undefined> {
    const value = this.publications.find(
      (item) =>
        missionKey(item.scope) === missionKey(scope) &&
        item.definition.id === missionId &&
        item.definition.version === version,
    );
    return value ? structuredClone(value) : undefined;
  }
}
