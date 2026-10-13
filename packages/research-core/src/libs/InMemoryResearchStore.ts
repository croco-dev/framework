import { emptyResearchRecord, researchIdentity } from "./ResearchContracts";
import type { ResearchRecord, ResearchScope, ResearchStore } from "./ResearchContracts";
/** Test/development only. Serialized copy-on-write transactions with rollback. */
export class InMemoryResearchStore implements ResearchStore {
  private readonly records = new Map<string, ResearchRecord>();
  private readonly locks = new Map<string, Promise<void>>();
  async read(scope: ResearchScope, id: string): Promise<ResearchRecord> {
    return structuredClone(this.records.get(researchIdentity(scope, id)) ?? emptyResearchRecord());
  }
  async transact<T>(
    scope: ResearchScope,
    id: string,
    operation: (record: ResearchRecord) => Promise<T>,
  ): Promise<T> {
    const key = researchIdentity(scope, id);
    const preceding = this.locks.get(key) ?? Promise.resolve();
    let release = () => {};
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, lock);
    await preceding;
    try {
      const record = await this.read(scope, id);
      const result = structuredClone(await operation(record));
      this.records.set(key, structuredClone(record));
      return result;
    } finally {
      release();
      if (this.locks.get(key) === lock) this.locks.delete(key);
    }
  }
}
