import { createElement as h, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type {
  ContactPolicyAdminEdit,
  ContactPolicyAdminRegistration,
  ContactPolicyAdminScope,
  ContactPolicyConsoleState,
} from "@croco/admin-core";
import type { ContactPolicyDecision } from "@croco/engagement-core";

export type ContactPolicyConsoleProps = Readonly<{
  target: ContactPolicyAdminScope;
  registration: ContactPolicyAdminRegistration;
  state: ContactPolicyConsoleState;
  canWrite: boolean;
  onSave(edit: ContactPolicyAdminEdit): Promise<void>;
  onDryRun(): Promise<ContactPolicyDecision>;
}>;

export function ContactPolicyConsole(props: ContactPolicyConsoleProps): ReactElement {
  const identity = JSON.stringify([
    props.target,
    "view" in props.state ? props.state.view.policy.revision : null,
  ]);
  return h(ContactPolicyForm, { ...props, key: identity });
}

function ContactPolicyForm({
  target,
  registration,
  state,
  canWrite,
  onSave,
  onDryRun,
}: ContactPolicyConsoleProps): ReactElement {
  const snapshot = "view" in state ? state.view.policy : undefined;
  const [limits, setLimits] = useState<Record<string, number>>({});
  const [priorities, setPriorities] = useState<Record<string, number>>({});
  const [quietHours, setQuietHours] = useState(
    snapshot === undefined ? registration.config.quietHours : snapshot.config.quietHours,
  );
  const [quietChanged, setQuietChanged] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const [outcome, setOutcome] = useState("");
  const [failed, setFailed] = useState(false);
  const [decision, setDecision] = useState<ContactPolicyDecision | undefined>(
    "decision" in state ? state.decision : undefined,
  );
  const run = async (operation: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setOutcome("");
    setDecision(undefined);
    setFailed(false);
    try {
      await operation();
    } catch {
      setFailed(true);
      setOutcome("Operation failed. Reload the policy before retrying; no success was confirmed.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const field = (
    label: string,
    value: string | number,
    change: (value: string) => void,
    type = "text",
    bounds?: { min: number; max: number },
  ) =>
    h(
      "label",
      { style: { display: "block", marginBlock: "0.5rem" } },
      label,
      h("input", {
        "aria-label": label,
        value,
        type,
        required: true,
        ...bounds,
        onChange: (event: ChangeEvent<HTMLInputElement>) => change(event.target.value),
      }),
    );
  const header = h(
    "header",
    null,
    h("h2", null, "Contact policy"),
    h("p", null, `${target.scope.app} / ${target.scope.environment} / ${target.scope.tenantId}`),
    h(
      "p",
      null,
      "Settings apply across this tenant. Controls only sends through the installed contact policy gate. Priority applies within a submitted batch; external sends are outside this budget.",
    ),
  );
  if (state.kind === "loading")
    return h(
      "section",
      { "aria-label": "Contact policy", "aria-busy": true },
      header,
      h("p", { role: "status" }, "Loading contact policy…"),
    );
  if (state.kind === "denied" || state.kind === "error")
    return h(
      "section",
      { "aria-label": "Contact policy" },
      header,
      h(
        "p",
        { role: "alert" },
        `${state.kind === "denied" ? "Access denied" : "Policy unavailable"}: ${state.code}`,
      ),
    );
  return h(
    "section",
    { "aria-label": "Contact policy", "aria-busy": pending },
    header,
    state.kind === "empty"
      ? h(
          "p",
          { role: "status" },
          "No policy configured. Save registered settings to initialize this scope.",
        )
      : null,
    state.kind === "partial" || (state.kind === "ready" && !state.view.historyComplete)
      ? h(
          "p",
          { role: "alert" },
          "Suppression history is incomplete. Displayed results do not represent all blocked sends.",
        )
      : null,
    h(
      "form",
      {
        onSubmit: (event) => {
          event.preventDefault();
          void run(async () => {
            await onSave({
              limits,
              priorities,
              ...(quietChanged ? { quietHours: quietHours ?? null } : {}),
              expectedRevision: snapshot?.revision ?? 0,
              reason,
              idempotencyKey: crypto.randomUUID(),
            });
            setOutcome("Policy saved. Reload to inspect the new revision.");
          });
        },
      },
      h(
        "fieldset",
        { disabled: pending || !canWrite },
        h("legend", null, "Code-permitted policy settings"),
        (snapshot?.config.rules ?? registration.config.rules)
          .filter((rule) => Object.hasOwn(registration.limits, rule.id))
          .map((rule) =>
            h(
              "div",
              { key: rule.id },
              field(
                `Limit: ${rule.id}`,
                limits[rule.id] ?? rule.limit,
                (value) => setLimits({ ...limits, [rule.id]: Number(value) }),
                "number",
                registration.limits[rule.id],
              ),
            ),
          ),
        (snapshot?.topics ?? registration.topics)
          .filter((topic) => Object.hasOwn(registration.priorities, topic.id))
          .map((topic) =>
            h(
              "div",
              { key: topic.id },
              field(
                `Priority: ${topic.id}`,
                priorities[topic.id] ?? topic.priority,
                (value) => setPriorities({ ...priorities, [topic.id]: Number(value) }),
                "number",
                registration.priorities[topic.id],
              ),
            ),
          ),
        registration.quietHours
          ? h(
              "fieldset",
              null,
              h("legend", null, "Quiet hours"),
              h(
                "label",
                null,
                h("input", {
                  type: "checkbox",
                  checked: !!quietHours,
                  onChange: (event: ChangeEvent<HTMLInputElement>) => {
                    setQuietChanged(true);
                    setQuietHours(
                      event.target.checked
                        ? { startMinute: 1320, endMinute: 480, timezone: "UTC" }
                        : undefined,
                    );
                  },
                }),
                "Enable quiet hours",
              ),
              quietHours
                ? h(
                    "div",
                    null,
                    field(
                      "Start minute",
                      quietHours.startMinute,
                      (value) => {
                        setQuietChanged(true);
                        setQuietHours({ ...quietHours, startMinute: Number(value) });
                      },
                      "number",
                      { min: 0, max: 1439 },
                    ),
                    field(
                      "End minute",
                      quietHours.endMinute,
                      (value) => {
                        setQuietChanged(true);
                        setQuietHours({ ...quietHours, endMinute: Number(value) });
                      },
                      "number",
                      { min: 0, max: 1439 },
                    ),
                    field("Timezone", quietHours.timezone, (value) => {
                      setQuietChanged(true);
                      setQuietHours({ ...quietHours, timezone: value });
                    }),
                  )
                : null,
            )
          : null,
        field("Audit reason", reason, setReason),
        h(
          "button",
          { type: "submit", disabled: !reason.trim() },
          pending ? "Saving…" : "Save policy",
        ),
      ),
    ),
    !canWrite ? h("p", null, "Read-only access") : null,
    h("p", null, `Dry-run and history subject: ${target.subject}`),
    h(
      "button",
      {
        type: "button",
        disabled: pending || !snapshot,
        onClick: () => {
          void run(async () => {
            setDecision(await onDryRun());
            setOutcome("Dry-run completed without reserving budget.");
          });
        },
      },
      "Dry-run current subject",
    ),
    pending ? h("p", { role: "status" }, "Operation in progress…") : null,
    outcome ? h("p", { role: failed ? "alert" : "status" }, outcome) : null,
    decision
      ? h(
          "p",
          { role: "status" },
          `${decision.allowed ? "Allowed" : "Blocked"}: ${decision.reason}; rule: ${decision.blockingRuleId ?? "none"}${decision.nextEligibleAt ? `; next eligible: ${decision.nextEligibleAt.toISOString()}` : ""}${decision.blockingCampaignIds?.length ? `; blocking campaigns: ${decision.blockingCampaignIds.join(", ")}` : ""}`,
        )
      : null,
    snapshot
      ? h(
          "section",
          { "aria-label": "Recent suppression reasons" },
          h("h3", null, "Recent suppression reasons across campaigns"),
          "view" in state && state.view.recentSuppressions.length
            ? h(
                "ul",
                null,
                state.view.recentSuppressions.map((entry) =>
                  h(
                    "li",
                    {
                      key: `${entry.logicalSendId}:${entry.occurredAt.toISOString()}`,
                    },
                    `${entry.campaignId ?? "Direct send"}: ${entry.decision.reason}; rule ${entry.decision.blockingRuleId ?? "none"}; ${entry.occurredAt.toISOString()}${entry.decision.blockingCampaignIds?.length ? `; blocking campaigns: ${entry.decision.blockingCampaignIds.join(", ")}` : ""}`,
                  ),
                ),
              )
            : h("p", null, "No suppression records in the returned history."),
        )
      : null,
  );
}
