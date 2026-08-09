import type { UsageBillingEvent, UsageBillingGateway } from "@croco/billing-core";
import { PolarRetryableUpstreamProblem } from "@croco/billing-polar";
import {
  readSqliteFixtureState,
  resetSqliteFixtureState,
  updateSqliteFixtureState,
} from "./SqliteFixtureState";

type StoredUsageEvent = Omit<UsageBillingEvent, "occurredAt"> & { occurredAt: string };
type StoredProviderState = { version: 1; acceptedEvents: Record<string, StoredUsageEvent> };

const EMPTY_PROVIDER_STATE: StoredProviderState = { version: 1, acceptedEvents: {} };

/** Credential-free file-backed provider fixture shared by the failure and recovery processes. */
export class FileUsageBillingGateway implements UsageBillingGateway {
  private available = true;
  constructor(private readonly filePath: string) {}

  setAvailable(available: boolean): void {
    this.available = available;
  }

  async reset(): Promise<void> {
    resetSqliteFixtureState(this.filePath, EMPTY_PROVIDER_STATE);
  }

  async ingest(events: readonly UsageBillingEvent[]) {
    if (!this.available) {
      throw new PolarRetryableUpstreamProblem({
        operation: "usage.ingest",
        provider: "polar",
      });
    }

    return updateSqliteFixtureState(this.filePath, EMPTY_PROVIDER_STATE, (state) => {
      const receipts = events.map((event) => {
        if (state.acceptedEvents[event.eventId]) {
          return { eventId: event.eventId, status: "duplicate" as const };
        }
        state.acceptedEvents[event.eventId] = {
          ...event,
          occurredAt: event.occurredAt.toISOString(),
        };
        return { eventId: event.eventId, status: "inserted" as const };
      });
      return { receipts };
    });
  }

  async getCustomerMeterState(query: { billingAccountId: string; meterId: string }) {
    const events = Object.values(
      readSqliteFixtureState(this.filePath, EMPTY_PROVIDER_STATE).acceptedEvents,
    ).filter(
      (event) =>
        event.billingAccountId === query.billingAccountId && event.meterId === query.meterId,
    );
    if (events.length === 0) return null;

    return {
      billingAccountId: query.billingAccountId,
      meterId: query.meterId,
      updatedAt: new Date("2026-01-02T00:00:03.000Z"),
      value: events.reduce((total, event) => total + event.value, 0),
    };
  }

  async getAcceptedUsage(billingAccountId: string, meterId: string): Promise<number> {
    return Object.values(readSqliteFixtureState(this.filePath, EMPTY_PROVIDER_STATE).acceptedEvents)
      .filter((event) => event.billingAccountId === billingAccountId && event.meterId === meterId)
      .reduce((total, event) => total + event.value, 0);
  }
}
