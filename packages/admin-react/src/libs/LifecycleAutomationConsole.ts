import { createElement, type ReactElement } from "react";
import type {
  LifecycleAutomationConsoleState,
  LifecycleDryRunEvidence,
  LifecycleRuleAdminAction,
  LifecycleRuleOperation,
  LifecycleRunOperation,
} from "./lifecycleAutomation";

export type LifecycleAutomationConsoleProps = {
  readonly state: LifecycleAutomationConsoleState;
  readonly onRuleAction?: (action: LifecycleRuleAdminAction) => void;
  readonly onDryRunFixture?: (fixtureId: string) => void;
  readonly onRecoverRun?: (run: LifecycleRunOperation) => void;
};

function field(label: string, value: string): ReactElement {
  return createElement(
    "div",
    { className: "croco-lifecycle-field" },
    createElement("dt", null, label),
    createElement("dd", null, value),
  );
}

function RuleCard({
  operation,
  canWrite,
  onRuleAction,
}: {
  readonly operation: LifecycleRuleOperation;
  readonly canWrite: boolean;
  readonly onRuleAction?: (action: LifecycleRuleAdminAction) => void;
}): ReactElement {
  const { inspection } = operation;
  return createElement(
    "article",
    {
      className: "croco-lifecycle-rule",
      "data-rule-id": inspection.ruleId,
      "data-rule-state": inspection.state,
      "data-rule-version": inspection.version,
    },
    createElement("h3", null, `${inspection.ruleId} · ${inspection.version}`),
    createElement(
      "dl",
      null,
      field("state", inspection.state),
      field("fingerprint", inspection.fingerprint),
      field("executable fingerprint", inspection.executableFingerprint),
      field("severity", inspection.severity),
      field("triggers", inspection.triggers.map((trigger) => trigger.type).join(", ")),
      field(
        "cooldown",
        inspection.cooldownDurationMs ? `${inspection.cooldownDurationMs} ms` : "none",
      ),
      field("context requirements", inspection.contextRequirements.join(", ") || "none"),
      field(
        "action descriptors",
        inspection.actions.map((action) => `${action.type}:${action.id}`).join(", ") || "none",
      ),
    ),
    inspection.state === "unavailable"
      ? createElement(
          "p",
          { role: "alert" },
          "This persisted version has no matching code registration and cannot be activated.",
        )
      : null,
    operation.descriptorDiff.length > 0
      ? createElement(
          "section",
          {
            "aria-label": `Descriptor changes for ${inspection.ruleId} ${inspection.version}`,
          },
          createElement("h4", null, "Descriptor changes"),
          createElement(
            "ul",
            null,
            operation.descriptorDiff.map((diff) =>
              createElement(
                "li",
                { key: diff.field },
                `${diff.field}: ${diff.previous} → ${diff.next}`,
              ),
            ),
          ),
        )
      : null,
    createElement(
      "div",
      { className: "croco-lifecycle-rule-actions" },
      operation.actions.map((action) =>
        createElement(
          "div",
          { key: action.id },
          createElement(
            "button",
            {
              type: "button",
              disabled: !canWrite || !onRuleAction,
              onClick: () => onRuleAction?.(action),
            },
            action.label,
          ),
          action.warning ? createElement("p", { role: "note" }, action.warning) : null,
        ),
      ),
    ),
  );
}

export function LifecycleRuleOperations({
  rules,
  canWrite,
  onRuleAction,
}: {
  readonly rules: readonly LifecycleRuleOperation[];
  readonly canWrite: boolean;
  readonly onRuleAction?: (action: LifecycleRuleAdminAction) => void;
}): ReactElement {
  return createElement(
    "section",
    { "aria-labelledby": "croco-lifecycle-rules-heading" },
    createElement("h2", { id: "croco-lifecycle-rules-heading" }, "Lifecycle rules"),
    rules.length === 0
      ? createElement("p", null, "No lifecycle rules are registered.")
      : rules.map((operation) =>
          createElement(RuleCard, {
            key: `${operation.inspection.ruleId}:${operation.inspection.version}`,
            operation,
            canWrite,
            onRuleAction,
          }),
        ),
  );
}

export function LifecycleRunHistory({
  runs,
  onRecoverRun,
}: {
  readonly runs: readonly LifecycleRunOperation[];
  readonly onRecoverRun?: (run: LifecycleRunOperation) => void;
}): ReactElement {
  return createElement(
    "section",
    { "aria-labelledby": "croco-lifecycle-runs-heading" },
    createElement("h2", { id: "croco-lifecycle-runs-heading" }, "Lifecycle run history"),
    runs.length === 0
      ? createElement("p", null, "No lifecycle runs match the current filters.")
      : createElement(
          "table",
          null,
          createElement(
            "thead",
            null,
            createElement(
              "tr",
              null,
              ...[
                "Run",
                "Rule",
                "Version",
                "Fingerprint",
                "Tenant",
                "Signal",
                "Correlation",
                "Cooldown",
                "Outcome",
                "Actions",
                "Problem",
                "Recovery",
              ].map((heading) => createElement("th", { key: heading, scope: "col" }, heading)),
            ),
          ),
          createElement(
            "tbody",
            null,
            runs.map((operation) =>
              createElement(
                "tr",
                {
                  key: operation.run.id,
                  "data-run-outcome": operation.outcome,
                },
                createElement(
                  "th",
                  { scope: "row" },
                  operation.links?.operationsHref
                    ? createElement("a", { href: operation.links.operationsHref }, operation.run.id)
                    : operation.run.id,
                ),
                createElement("td", null, operation.run.ruleId),
                createElement("td", null, operation.run.ruleVersion),
                createElement("td", null, operation.run.ruleFingerprint),
                createElement(
                  "td",
                  null,
                  operation.links?.tenantHref
                    ? createElement(
                        "a",
                        { href: operation.links.tenantHref },
                        operation.run.tenantId,
                      )
                    : operation.run.tenantId,
                ),
                createElement(
                  "td",
                  null,
                  `${operation.run.signalType}${
                    operation.run.signalId ? ` · ${operation.run.signalId}` : ""
                  }`,
                ),
                createElement(
                  "td",
                  null,
                  operation.correlationIds.traceId ??
                    operation.correlationIds.requestId ??
                    operation.correlationIds.lifecycleRunId ??
                    operation.run.id,
                ),
                createElement(
                  "td",
                  null,
                  operation.run.skipReason === "cooldown_active"
                    ? "suppressed"
                    : operation.run.status === "skipped"
                      ? "skipped — cooldown not active"
                      : "passed",
                ),
                createElement("td", null, operation.outcome),
                createElement(
                  "td",
                  null,
                  operation.run.actionResults
                    .map((result) => `${result.type}:${result.actionId} (${result.status})`)
                    .join(", ") || "none",
                ),
                createElement("td", null, operation.problem?.code ?? "none"),
                createElement(
                  "td",
                  null,
                  operation.recovery
                    ? createElement(
                        "button",
                        {
                          type: "button",
                          disabled: !onRecoverRun,
                          onClick: () => onRecoverRun?.(operation),
                        },
                        operation.recovery.label,
                      )
                    : "Not declared safe",
                ),
              ),
            ),
          ),
        ),
  );
}

export function LifecycleDryRunPanel({
  evidence,
}: {
  readonly evidence: LifecycleDryRunEvidence;
}): ReactElement {
  const { result } = evidence;
  return createElement(
    "section",
    {
      "aria-labelledby": "croco-lifecycle-dry-run-heading",
      "data-evidence-kind": "dry-run",
    },
    createElement(
      "h2",
      { id: "croco-lifecycle-dry-run-heading" },
      "Dry-run evidence — not dispatched",
    ),
    createElement(
      "dl",
      null,
      field("rule version", `${result.ruleId} · ${result.ruleVersion}`),
      field("matched", String(result.matched)),
      field(
        "suppression",
        result.suppression.suppressed
          ? (result.suppression.reason ?? "suppressed")
          : "not suppressed",
      ),
      field(
        "proposed actions",
        result.proposedActions.map((action) => `${action.type}:${action.id}`).join(", ") || "none",
      ),
      field("Problems", result.problems.map((entry) => entry.code).join(", ") || "none"),
    ),
    createElement(
      "p",
      { role: "note" },
      "Dry runs do not dispatch actions, persist production runs, or consume cooldown.",
    ),
  );
}

export function LifecycleAutomationConsole({
  state,
  onRuleAction,
  onDryRunFixture,
  onRecoverRun,
}: LifecycleAutomationConsoleProps): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      { "aria-busy": true, "aria-label": "Lifecycle automation operations" },
      "Loading lifecycle automation operations…",
    );
  }
  if (state.kind === "permission-denied") {
    return createElement(
      "section",
      { "aria-label": "Lifecycle automation operations" },
      createElement("h2", null, "Lifecycle automation operations"),
      createElement("p", { role: "alert" }, `${state.problem.code}: ${state.problem.message}`),
    );
  }

  const canDryRun = state.grantedPermissions.includes("lifecycle:dry-run");
  return createElement(
    "section",
    { "aria-labelledby": "croco-lifecycle-console-heading" },
    createElement(
      "h1",
      { id: "croco-lifecycle-console-heading" },
      "Lifecycle automation operations",
    ),
    state.problems.map((entry) =>
      createElement(
        "p",
        { key: `${entry.source}:${entry.code}`, role: "alert" },
        `${entry.code}: ${entry.message}`,
      ),
    ),
    state.kind === "empty"
      ? createElement("p", null, "No lifecycle rules or runs are available.")
      : createElement(LifecycleRuleOperations, {
          rules: state.rules,
          canWrite: state.grantedPermissions.includes("lifecycle:write"),
          onRuleAction,
        }),
    createElement(
      "section",
      { "aria-labelledby": "croco-lifecycle-fixtures-heading" },
      createElement("h2", { id: "croco-lifecycle-fixtures-heading" }, "Dry-run fixtures"),
      state.fixtures.length === 0
        ? createElement("p", null, "No stored, redacted fixtures are available.")
        : createElement(
            "ul",
            null,
            state.fixtures.map((fixture) =>
              createElement(
                "li",
                { key: fixture.id },
                createElement("span", null, fixture.label),
                fixture.description ? createElement("p", null, fixture.description) : null,
                createElement(
                  "button",
                  {
                    type: "button",
                    disabled: !canDryRun || !onDryRunFixture,
                    onClick: () => onDryRunFixture?.(fixture.id),
                  },
                  "Dry run",
                ),
              ),
            ),
          ),
    ),
    state.dryRun?.kind === "succeeded"
      ? createElement(LifecycleDryRunPanel, { evidence: state.dryRun.evidence })
      : state.dryRun
        ? createElement(
            "p",
            { role: "alert", "data-evidence-kind": "dry-run-problem" },
            `${state.dryRun.problem.code}: ${state.dryRun.problem.message}`,
          )
        : null,
    state.kind === "ready"
      ? createElement(LifecycleRunHistory, {
          runs: state.runs,
          onRecoverRun,
        })
      : null,
  );
}
