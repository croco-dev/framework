import { InMemoryJourneyStore, JourneyEngine } from "@croco/lifecycle-core";
import type {
  JourneyDefinition,
  JourneyEngineOptions,
  JourneyEntry,
  JourneyScope,
} from "@croco/lifecycle-core";

export const scope: JourneyScope = {
  appId: "demo-store",
  environment: "local",
  tenantId: "demo-tenant",
};

export const definition: JourneyDefinition = {
  id: "interest-follow-up",
  version: "1",
  entry: "wait-one-hour",
  goal: { registration: "purchased", params: {} },
  reentry: "once",
  unknownRetryMs: 60_000,
  unknownDeadlineMs: 3_600_000,
  nodes: [
    { id: "wait-one-hour", kind: "wait", durationMs: 3_600_000, next: "still-interested" },
    {
      id: "still-interested",
      kind: "condition",
      predicate: { registration: "interested", params: {} },
      matched: "first-message",
      unmatched: "done",
    },
    {
      id: "first-message",
      kind: "action",
      action: { registration: "message", params: { template: "interest-follow-up" } },
      next: "wait-one-day",
    },
    { id: "wait-one-day", kind: "wait", durationMs: 86_400_000, next: "second-message" },
    {
      id: "second-message",
      kind: "action",
      action: { registration: "message", params: { template: "interest-follow-up" } },
      next: "done",
    },
    { id: "done", kind: "end" },
  ],
};

type CustomerFacts = {
  purchased: boolean;
  interested: boolean;
  consent: boolean;
  available: boolean;
};

export function createExample() {
  let clock = new Date("2026-09-29T00:00:00.000Z");
  const facts = new Map<string, CustomerFacts>();
  const sent: string[] = [];
  const store = new InMemoryJourneyStore();
  const engineOptions = {
    predicates: {
      purchased: {
        validate: () => {},
        evaluate: async ({ episode }) => facts.get(episode.subject)?.purchased ?? "unknown",
      },
      interested: {
        validate: () => {},
        evaluate: async ({ episode }) => facts.get(episode.subject)?.interested ?? "unknown",
      },
    },
    actions: {
      message: {
        capability: "message",
        validate: (params) => {
          if (params.template !== "interest-follow-up") {
            throw new TypeError("Only the registered message template is available");
          }
        },
        dispatch: async (_context, _params, intent) => {
          sent.push(intent.idempotencyKey);
          return "accepted";
        },
      },
    },
    capabilities: ["message"],
    checkLatest: async ({ episode }) => ({
      consent: facts.get(episode.subject)?.consent ?? "unknown",
      resource: facts.get(episode.subject)?.available ?? "unknown",
    }),
    now: () => clock,
  } satisfies Omit<JourneyEngineOptions, "store">;
  const engine = new JourneyEngine({ ...engineOptions, store });
  engine.register(definition);

  return {
    engine,
    store,
    sent,
    setFacts(subject: string, value: CustomerFacts) {
      facts.set(subject, value);
    },
    advance(milliseconds: number) {
      clock = new Date(clock.getTime() + milliseconds);
    },
    now() {
      return clock;
    },
    entry(subject: string): JourneyEntry {
      return {
        id: `episode-${subject}`,
        scope,
        subject,
        businessObjectRef: `item-${subject}`,
        episodeKey: "interest-confirmed",
        sourceEventId: `interest-confirmed-${subject}`,
      };
    },
    async preview(draft: JourneyDefinition, subject: string) {
      const previewEngine = new JourneyEngine({
        ...engineOptions,
        store: new InMemoryJourneyStore(),
      });
      previewEngine.register(draft);
      return previewEngine.dryRun(draft.id, draft.version, this.entry(subject));
    },
  };
}
