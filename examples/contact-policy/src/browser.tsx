import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";

import { ContactPolicyConsole } from "@croco/admin-react";
import type { ContactPolicyAdminRegistration, ContactPolicyConsoleState } from "@croco/admin-core";

const registration: ContactPolicyAdminRegistration = {
  config: {
    version: "demo-v1",
    rules: [{ id: "daily", limit: 3, windowMs: 86_400_000 }],
    reservationTtlMs: 60_000,
  },
  topics: [{ id: "news", kind: "marketing", priority: 1, messageIds: ["newsletter"] }],
  limits: { daily: { min: 1, max: 10 } },
  quietHours: true,
  priorities: { news: { min: 0, max: 5 } },
};

const initialView = {
  policy: { revision: 1, config: registration.config, topics: registration.topics },
  historyComplete: true,
  recentSuppressions: [
    {
      logicalSendId: "synthetic-send",
      campaignId: "spring-campaign",
      occurredAt: new Date("2026-09-29T00:00:00.000Z"),
      decision: {
        allowed: false as const,
        reason: "limit" as const,
        blockingRuleId: "daily",
        blockingCampaignIds: ["winter-campaign"],
      },
    },
  ],
};

function App() {
  const parameters = new URLSearchParams(location.search);
  const requestedState = parameters.get("state") ?? "ready";
  const initialState: ContactPolicyConsoleState =
    requestedState === "ready" || requestedState === "partial"
      ? { kind: requestedState, view: initialView }
      : requestedState === "denied" || requestedState === "error"
        ? { kind: requestedState, code: "POLICY_UNAVAILABLE" }
        : requestedState === "loading" || requestedState === "empty"
          ? { kind: requestedState }
          : { kind: "error", code: "UNKNOWN_DEMO_STATE" };
  const [state, setState] = useState<ContactPolicyConsoleState>(initialState);
  return h(ContactPolicyConsole, {
    target: {
      scope: { app: "demo", environment: "test", tenantId: "tenant-example" },
      subject: "subject-example",
    },
    registration,
    state,
    canWrite: !parameters.has("readonly"),
    onSave: async (edit) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (parameters.has("fail")) throw new Error("Synthetic save failure");
      const current = "view" in state ? state.view : initialView;
      setState({
        kind: "ready",
        view: {
          ...current,
          policy: {
            ...current.policy,
            revision: edit.expectedRevision + 1,
            config: {
              ...current.policy.config,
              version: `${registration.config.version}:${edit.expectedRevision + 1}`,
              rules: current.policy.config.rules.map((rule) => ({
                ...rule,
                limit: edit.limits[rule.id] ?? rule.limit,
              })),
              quietHours:
                edit.quietHours === undefined
                  ? current.policy.config.quietHours
                  : (edit.quietHours ?? undefined),
            },
            topics: current.policy.topics.map((topic) => ({
              ...topic,
              priority: edit.priorities[topic.id] ?? topic.priority,
            })),
          },
        },
      });
    },
    onDryRun: async () => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      if (parameters.has("fail")) throw new Error("Synthetic dry-run failure");
      return {
        allowed: false,
        reason: "limit" as const,
        blockingRuleId: "daily",
        blockingCampaignIds: ["winter-campaign"],
      };
    },
  });
}

const root = document.getElementById("root");
if (root === null) throw new Error("Example root is missing");
createRoot(root).render(h(App));
