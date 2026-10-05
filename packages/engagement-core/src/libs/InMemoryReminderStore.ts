import { assertReminderScope } from "./ReminderContracts";
import type {
  Reminder,
  ReminderMutation,
  ReminderOccurrence,
  ReminderScope,
  ReminderStore,
  ReminderTransaction,
} from "./ReminderContracts";

type Aggregate = {
  reminders: Reminder[];
  occurrences: ReminderOccurrence[];
  mutations: ReminderMutation[];
};

/** Development/test store. Production adapters must durably serialize each subject transaction. */
export class InMemoryReminderStore implements ReminderStore {
  private readonly aggregates = new Map<string, Aggregate>();
  private readonly locks = new Map<string, Promise<void>>();

  async transact<T>(
    scope: ReminderScope,
    subject: string,
    operation: (transaction: ReminderTransaction) => Promise<T>,
  ): Promise<T> {
    assertReminderScope(scope, subject);
    const key = JSON.stringify([scope.app, scope.environment, scope.tenantId, subject]);
    const preceding = this.locks.get(key) ?? Promise.resolve();
    let release = () => {};
    const lock = new Promise<void>((resolve) => {
      release = resolve;
    });
    this.locks.set(key, lock);
    await preceding;
    try {
      const aggregate = structuredClone(
        this.aggregates.get(key) ?? { reminders: [], occurrences: [], mutations: [] },
      );
      const transaction: ReminderTransaction = {
        get reminders() {
          return structuredClone(aggregate.reminders);
        },
        get occurrences() {
          return structuredClone(aggregate.occurrences);
        },
        get mutations() {
          return structuredClone(aggregate.mutations);
        },
        saveReminder: (value) => save(aggregate.reminders, value, (item) => item.id),
        saveOccurrence: (value) => save(aggregate.occurrences, value, (item) => item.id),
        saveMutation: (value) => save(aggregate.mutations, value, (item) => item.idempotencyKey),
      };
      const result = await operation(transaction);
      const snapshot = structuredClone(result);
      this.aggregates.set(key, structuredClone(aggregate));
      return snapshot;
    } finally {
      release();
      if (this.locks.get(key) === lock) this.locks.delete(key);
    }
  }
}

function save<T>(items: T[], value: T, key: (item: T) => string): void {
  const index = items.findIndex((item) => key(item) === key(value));
  if (index === -1) items.push(structuredClone(value));
  else items[index] = structuredClone(value);
}
