import { createElement as h, useRef, useState } from "react";
import type { ChangeEvent, ReactElement } from "react";
import type { ChoicePolicyEntry } from "@croco/billing-core/cancellation";
import type { RetentionOfferConsoleState, RetentionOfferEdit } from "@croco/admin-core";

export type RetentionOfferConsoleProps = Readonly<{
  state: RetentionOfferConsoleState;
  canWrite: boolean;
  onSave(edit: RetentionOfferEdit): Promise<void>;
  onRefresh(): Promise<void>;
}>;
export function RetentionOfferConsole(props: RetentionOfferConsoleProps): ReactElement {
  const policy = "view" in props.state ? props.state.view.policy : undefined;
  return h(RetentionOfferForm, {
    ...props,
    key: policy
      ? JSON.stringify([policy.appId, policy.environment, policy.tenantId, policy.version])
      : props.state.kind,
  });
}
function RetentionOfferForm({
  state,
  canWrite,
  onSave,
  onRefresh,
}: RetentionOfferConsoleProps): ReactElement {
  const view = "view" in state ? state.view : undefined;
  const [entries, setEntries] = useState<readonly ChoicePolicyEntry[]>(
    () =>
      view?.registration
        .filter((choice) => choice.action !== "cancel")
        .map(
          (choice) =>
            view.policy.entries.find((entry) => entry.choiceId === choice.id) ?? {
              choiceId: choice.id,
              label: choice.label,
              order: 0,
              enabled: false,
              billingPeriods: ["initial", "renewal"] as const,
              refundKinds: ["none", "partial", "full"] as const,
            },
        ) ?? [],
  );
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState("");
  const [locked, setLocked] = useState(false);
  const busy = useRef(false);
  const run = async (operation: () => Promise<void>, save: boolean) => {
    if (busy.current || (save && locked)) return;
    busy.current = true;
    setPending(true);
    setOutcome("");
    try {
      await operation();
      setLocked(save);
      setOutcome(
        save ? "Policy saved. Refresh to inspect the new revision." : "Current policy loaded.",
      );
    } catch {
      setLocked(true);
      setOutcome("Operation failed or outcome is unknown. Refresh before another edit.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  return h(
    "section",
    { "aria-label": "Retention offers", "aria-busy": pending },
    h("h2", null, "Retention offers"),
    state.kind === "loading" ? h("p", { role: "status" }, "Loading retention policy…") : null,
    state.kind === "empty" ? h("p", { role: "status" }, "No retention policy registered.") : null,
    state.kind === "error" || state.kind === "denied"
      ? h("p", { role: "alert" }, `${state.kind}: ${state.code}`)
      : null,
    state.kind === "partial"
      ? h(
          "p",
          { role: "alert" },
          "Results are incomplete and do not represent all cancellation sessions.",
        )
      : null,
    view
      ? h(
          "div",
          null,
          h(
            "p",
            null,
            `${view.policy.appId} / ${view.policy.environment} / ${view.policy.tenantId}; revision ${view.policy.version}`,
          ),
          h(
            "form",
            {
              onSubmit: (event) => {
                event.preventDefault();
                if (canWrite && reason.trim())
                  void run(
                    () =>
                      onSave({
                        entries,
                        reason: reason.trim(),
                        expectedRevision: view.policy.version,
                        idempotencyKey: crypto.randomUUID(),
                      }),
                    true,
                  );
              },
            },
            h(
              "fieldset",
              { disabled: pending || locked || !canWrite },
              h("legend", null, "Code-registered choices"),
              entries.map((entry) => {
                const registered = view.registration.find((choice) => choice.id === entry.choiceId);
                const update = (patch: Partial<typeof entry>) =>
                  setEntries(
                    entries.map((current) =>
                      current.choiceId === entry.choiceId ? { ...current, ...patch } : current,
                    ),
                  );
                return h(
                  "fieldset",
                  { key: entry.choiceId },
                  h("legend", null, entry.choiceId),
                  h("p", null, registered?.consequence),
                  h(
                    "label",
                    null,
                    "Label",
                    h("input", {
                      required: true,
                      value: entry.label,
                      onChange: (event: ChangeEvent<HTMLInputElement>) =>
                        update({ label: event.target.value }),
                    }),
                  ),
                  h(
                    "label",
                    null,
                    "Order",
                    h("input", {
                      type: "number",
                      min: 0,
                      step: 1,
                      required: true,
                      value: entry.order,
                      onChange: (event: ChangeEvent<HTMLInputElement>) =>
                        update({ order: Number(event.target.value) }),
                    }),
                  ),
                  h(
                    "label",
                    null,
                    h("input", {
                      type: "checkbox",
                      checked: entry.enabled,
                      onChange: (event: ChangeEvent<HTMLInputElement>) =>
                        update({ enabled: event.target.checked }),
                    }),
                    "Enabled",
                  ),
                  h(
                    "fieldset",
                    null,
                    h("legend", null, "Billing periods"),
                    (["initial", "renewal"] as const).map((period) =>
                      h(
                        "label",
                        { key: period },
                        h("input", {
                          type: "checkbox",
                          checked: entry.billingPeriods.includes(period),
                          onChange: (event: ChangeEvent<HTMLInputElement>) =>
                            update({
                              billingPeriods: event.target.checked
                                ? [...entry.billingPeriods, period]
                                : entry.billingPeriods.filter((value) => value !== period),
                            }),
                        }),
                        period,
                      ),
                    ),
                  ),
                  h(
                    "fieldset",
                    null,
                    h("legend", null, "Refund quote groups"),
                    (["none", "partial", "full"] as const).map((kind) =>
                      h(
                        "label",
                        { key: kind },
                        h("input", {
                          type: "checkbox",
                          checked: entry.refundKinds.includes(kind),
                          onChange: (event: ChangeEvent<HTMLInputElement>) =>
                            update({
                              refundKinds: event.target.checked
                                ? [...entry.refundKinds, kind]
                                : entry.refundKinds.filter((value) => value !== kind),
                            }),
                        }),
                        kind,
                      ),
                    ),
                  ),
                );
              }),
              h(
                "label",
                null,
                "Audit reason",
                h("input", {
                  required: true,
                  value: reason,
                  onChange: (event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value),
                }),
              ),
              h(
                "button",
                { type: "submit", disabled: !reason.trim() },
                pending ? "Saving…" : "Save retention policy",
              ),
            ),
          ),
          !canWrite ? h("p", null, "Read-only access") : null,
          h("h3", null, "Results by policy, billing period and authoritative refund quote"),
          h(
            "ul",
            null,
            view.reports.map((report) =>
              h(
                "li",
                {
                  key: JSON.stringify([
                    report.policyVersion,
                    report.subscriptionAgeDays,
                    report.billingPeriod,
                    report.refund,
                    report.amount,
                    report.currency,
                  ]),
                },
                `Policy ${report.policyVersion}; subscription age ${report.subscriptionAgeDays} days; ${report.billingPeriod}; ${report.refund}: ${report.amount} ${report.currency}. Sessions ${report.sessions}; displayed ${report.displayed}; accepted ${report.accepted}; kept ${report.kept}; cancellation choices ${report.cancelled}; scheduled ${report.scheduled}; ended ${report.ended}; refunds confirmed ${report.refundsConfirmed}; pending ${report.pending}; indeterminate ${report.indeterminate}.`,
              ),
            ),
          ),
        )
      : null,
    outcome ? h("p", { role: "status" }, outcome) : null,
    h(
      "button",
      { type: "button", disabled: pending, onClick: () => void run(onRefresh, false) },
      "Refresh retention policy",
    ),
  );
}
