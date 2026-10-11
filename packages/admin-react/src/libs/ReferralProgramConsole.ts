import { createElement, type ChangeEvent, type ReactElement } from "react";

import type {
  ReferralConsoleAction,
  ReferralConsoleReadyState,
  ReferralConsoleState,
  ReferralProgramEditorDraft,
} from "@croco/admin-core";

export type ReferralProgramConsoleProps = {
  readonly state: ReferralConsoleState;
  readonly editor?: ReferralProgramEditorDraft;
  readonly editorErrors?: Readonly<Record<string, string>>;
  readonly selectedAttributionId?: string;
  readonly onEditorChange?: (editor: ReferralProgramEditorDraft) => void;
  readonly onSubmitProgram?: (editor: ReferralProgramEditorDraft) => void;
  readonly onSelectAttribution?: (attributionId: string) => void;
  readonly onAction?: (action: ReferralConsoleAction) => void;
  readonly onRefresh?: () => void;
};

const EMPTY_EDITOR: ReferralProgramEditorDraft = {
  id: "",
  versionText: "1",
  familyId: "",
  benefitCycleId: "",
  qualifyingAction: "",
  conversionWindowDaysText: "30",
  referrerKind: "trial-credits",
  referrerCreditAmount: "",
  referrerWalletKey: "referral",
  recipientKind: "trial-credits",
  recipientCreditAmount: "",
  recipientWalletKey: "welcome",
  startsAtText: "",
  endsAtText: "",
  perSubjectLimitText: "1",
  budgetTotal: "",
  budgetPerAttribution: "",
  actorId: "",
  reason: "",
  idempotencyKey: "",
};

function actionLabel(kind: ReferralConsoleAction["kind"]): string {
  if (kind === "register-program") return "Register program";
  if (kind === "expire-attributions") return "Expire attributions";
  if (kind === "cancel-benefit") return "Cancel benefit";
  if (kind === "return-benefit") return "Return benefit";
  return "Resolve attribution";
}

/**
 * Operator console for referral programs. Subjects render masked until the
 * `referrals:read:pii` permission is granted, and indeterminate grants stay
 * locked until reconciliation or an explicit operator decision with verified
 * grant references.
 */
export function ReferralProgramConsole({
  editor,
  editorErrors,
  onAction,
  onEditorChange,
  onRefresh,
  onSelectAttribution,
  onSubmitProgram,
  selectedAttributionId,
  state,
}: ReferralProgramConsoleProps): ReactElement {
  if (state.kind === "loading") {
    return createElement(
      "section",
      { "aria-busy": true, "aria-label": "Referral operations", "data-state": "loading" },
      createElement("h1", null, "Referrals"),
      createElement("p", null, "Loading referral programs and attributions."),
    );
  }
  if (state.kind === "empty") {
    return createElement(
      "section",
      { "aria-label": "Referral operations", "data-state": "empty" },
      createElement("h1", null, "Referrals"),
      createElement("p", null, state.message ?? "No referral programs are registered yet."),
      createEditor(editor ?? EMPTY_EDITOR, editorErrors ?? {}, onEditorChange, onSubmitProgram),
    );
  }
  if (state.kind === "permission-denied") {
    return createElement(
      "section",
      { "aria-label": "Referral operations", "data-state": "permission-denied", role: "alert" },
      createElement("h1", null, state.problem.title ?? "Referral permission denied"),
      createElement("p", null, state.problem.detail ?? state.problem.code),
      onRefresh ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry") : null,
    );
  }
  if (state.kind === "problem") {
    return createElement(
      "section",
      {
        "aria-label": "Referral operations problem",
        "data-problem-code": state.problem.code,
        "data-state": "problem",
        role: "alert",
      },
      createElement("h1", null, state.problem.title ?? "Referral console unavailable"),
      createElement("p", null, state.problem.detail ?? state.problem.code),
      onRefresh
        ? createElement("button", { onClick: onRefresh, type: "button" }, "Retry referrals")
        : null,
    );
  }
  return createReadyConsole({
    editor,
    editorErrors,
    onAction,
    onEditorChange,
    onRefresh,
    onSelectAttribution,
    onSubmitProgram,
    selectedAttributionId,
    state,
  });
}

function createReadyConsole({
  editor,
  editorErrors,
  onAction,
  onEditorChange,
  onRefresh,
  onSelectAttribution,
  onSubmitProgram,
  selectedAttributionId,
  state,
}: Omit<ReferralProgramConsoleProps, "state"> & {
  readonly state: ReferralConsoleReadyState;
}): ReactElement {
  const selected =
    state.snapshot.attributions.find((entry) => entry.id === selectedAttributionId) ??
    state.snapshot.attributions[0];
  return createElement(
    "section",
    {
      "aria-label": "Referral operations",
      "data-generated-at": state.snapshot.generatedAt.toISOString(),
      "data-state": "ready",
    },
    createElement("h1", null, "Referrals"),
    onRefresh
      ? createElement("button", { onClick: onRefresh, type: "button" }, "Refresh referrals")
      : null,
    createElement(
      "p",
      null,
      `${state.snapshot.programs.length} programs · ${state.snapshot.attributions.length} attributions · funnel ${state.snapshot.funnel.clicks}/${state.snapshot.funnel.claims}/${state.snapshot.funnel.signups}/${state.snapshot.funnel.qualified}/${state.snapshot.funnel.fulfilled} · next cycle ${state.snapshot.nextShareCycle}.`,
    ),
    createElement(
      "section",
      { "aria-label": "Referral programs" },
      createElement("h2", null, "Programs"),
      state.snapshot.programs.length === 0
        ? createElement("p", null, "No referral programs are registered yet.")
        : createElement(
            "ul",
            null,
            state.snapshot.programs.map((program) =>
              createElement(
                "li",
                { "data-program-id": program.id, key: `${program.id}@${program.version}` },
                `${program.id} v${program.version} · cycle ${program.benefitCycleId} · referrer ${program.referrerFace} · recipient ${program.recipientFace} · ${program.status} · budget ${program.budgetReserved}/${program.budgetTotal}`,
              ),
            ),
          ),
    ),
    createEditor(editor ?? EMPTY_EDITOR, editorErrors ?? {}, onEditorChange, onSubmitProgram),
    createElement(
      "section",
      { "aria-label": "Referral attributions" },
      createElement("h2", null, "Attributions"),
      state.snapshot.attributions.length === 0
        ? createElement("p", null, "No attributions match the current scope.")
        : createElement(
            "ol",
            null,
            state.snapshot.attributions.map((entry) =>
              createElement(
                "li",
                { "data-attribution-state": entry.state, key: entry.id },
                createElement(
                  "button",
                  {
                    "aria-current": entry.id === selected?.id ? "true" : undefined,
                    onClick: () => onSelectAttribution?.(entry.id),
                    type: "button",
                  },
                  `${entry.id} · ${entry.state}`,
                ),
                createElement(
                  "span",
                  null,
                  ` · referrer ${entry.referrer.maskedId} · recipient ${entry.recipient?.maskedId ?? "pending"} · cycle ${entry.cycleIndex}`,
                ),
              ),
            ),
          ),
    ),
    selected ? createAttributionDetail(selected) : null,
    createElement(
      "section",
      { "aria-label": "Audited referral actions" },
      createElement("h2", null, "Actions"),
      createElement(
        "ul",
        null,
        state.actions.map((action) =>
          createElement(
            "li",
            { key: `${action.kind}:${action.targetId}` },
            createElement(
              "button",
              {
                "data-action": action.kind,
                "data-target-id": action.targetId,
                disabled: !action.allowed || onAction === undefined,
                onClick: () => onAction?.(action),
                title: action.reason,
                type: "button",
              },
              actionLabel(action.kind),
            ),
          ),
        ),
      ),
    ),
  );
}

function createAttributionDetail(
  entry: ReferralConsoleReadyState["snapshot"]["attributions"][number],
): ReactElement {
  const outcome =
    entry.state === "held"
      ? `Held: ${entry.holdReason ?? "duplicate-claim"}. Only the first valid referral counts.`
      : entry.state === "rejected"
        ? `Rejected: ${entry.rejectReason ?? "existing-customer"}.`
        : entry.state === "indeterminate"
          ? "The grant outcome is unclear. The budget stays locked until reconciliation or an operator decision."
          : `${entry.state} · claimed ${entry.claimedAt.toISOString()}`;
  return createElement(
    "section",
    { "aria-label": `Attribution ${entry.id} details` },
    createElement("h3", null, `Attribution ${entry.id}`),
    createElement(
      "p",
      null,
      `${entry.programId} v${entry.programVersion} · referrer ${entry.referrer.maskedId} · recipient ${entry.recipient?.maskedId ?? "pending"}`,
    ),
    createElement("p", { role: "status" }, outcome),
  );
}

function field(
  editor: ReferralProgramEditorDraft,
  editorErrors: Readonly<Record<string, string>>,
  onEditorChange: ((editor: ReferralProgramEditorDraft) => void) | undefined,
  name: keyof ReferralProgramEditorDraft,
  label: string,
): ReactElement {
  return createElement(
    "label",
    { key: name },
    label,
    createElement("input", {
      name,
      onChange: (event: ChangeEvent<HTMLInputElement>) =>
        onEditorChange?.({ ...editor, [name]: event.target.value }),
      value: editor[name],
    }),
    editorErrors[name] ? createElement("span", { role: "alert" }, editorErrors[name]) : null,
  );
}

function select(
  editor: ReferralProgramEditorDraft,
  onEditorChange: ((editor: ReferralProgramEditorDraft) => void) | undefined,
  name: "referrerKind" | "recipientKind",
  label: string,
): ReactElement {
  return createElement(
    "label",
    { key: name },
    label,
    createElement(
      "select",
      {
        name,
        onChange: (event: ChangeEvent<HTMLSelectElement>) =>
          onEditorChange?.({
            ...editor,
            [name]: event.target.value as "trial-credits" | "none",
          }),
        value: editor[name],
      },
      createElement("option", { value: "trial-credits" }, "Trial credits"),
      createElement("option", { value: "none" }, "No benefit (track progress)"),
    ),
  );
}

function createEditor(
  editor: ReferralProgramEditorDraft,
  editorErrors: Readonly<Record<string, string>>,
  onEditorChange: ((editor: ReferralProgramEditorDraft) => void) | undefined,
  onSubmitProgram: ((editor: ReferralProgramEditorDraft) => void) | undefined,
): ReactElement {
  return createElement(
    "section",
    { "aria-label": "Register referral program" },
    createElement("h2", null, "Register program"),
    createElement(
      "p",
      null,
      "A fresh allowance always requires a new explicit benefit cycle id; revision alone never resets family limits.",
    ),
    field(editor, editorErrors, onEditorChange, "id", "Program id"),
    field(editor, editorErrors, onEditorChange, "versionText", "Version"),
    field(editor, editorErrors, onEditorChange, "familyId", "Family id (defaults to program id)"),
    field(editor, editorErrors, onEditorChange, "benefitCycleId", "Benefit cycle id"),
    field(editor, editorErrors, onEditorChange, "qualifyingAction", "Qualifying action"),
    field(
      editor,
      editorErrors,
      onEditorChange,
      "conversionWindowDaysText",
      "Conversion window (days)",
    ),
    select(editor, onEditorChange, "referrerKind", "Referrer benefit"),
    field(editor, editorErrors, onEditorChange, "referrerCreditAmount", "Referrer credit amount"),
    select(editor, onEditorChange, "recipientKind", "Recipient benefit"),
    field(editor, editorErrors, onEditorChange, "recipientCreditAmount", "Recipient credit amount"),
    field(editor, editorErrors, onEditorChange, "startsAtText", "Starts at"),
    field(editor, editorErrors, onEditorChange, "endsAtText", "Ends at"),
    field(editor, editorErrors, onEditorChange, "perSubjectLimitText", "Per-subject limit"),
    field(editor, editorErrors, onEditorChange, "budgetTotal", "Total budget"),
    field(editor, editorErrors, onEditorChange, "budgetPerAttribution", "Budget per attribution"),
    field(editor, editorErrors, onEditorChange, "actorId", "Actor id"),
    field(editor, editorErrors, onEditorChange, "reason", "Reason"),
    field(editor, editorErrors, onEditorChange, "idempotencyKey", "Idempotency key"),
    onSubmitProgram
      ? createElement(
          "button",
          { onClick: () => onSubmitProgram(editor), type: "button" },
          "Submit program",
        )
      : null,
  );
}
