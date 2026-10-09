import { createElement as h } from "react";
import type { ReactElement } from "react";
import type {
  ReferralAttribution,
  ReferralBenefit,
  ReferralFunnelCounts,
  ReferralLink,
} from "@croco/referral-core";

export type ReferralShareState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied"; message: string; retry?: () => void }>
  | Readonly<{ kind: "error"; message: string; retry?: () => void }>
  | Readonly<{ kind: "ready"; link: ReferralLink; shareHref: string; expiresAt: Date }>;

export type ReferralShareCardProps = Readonly<{
  state: ReferralShareState;
  programName?: string;
  onCopy?: (shareHref: string) => void;
}>;

/**
 * Referrer-facing share card. Renders the shareable landing href only; the
 * raw link token and hashes never leave the generating service response, and
 * this component never asks for contacts or sends bulk invitations.
 */
export function ReferralShareCard({
  state,
  programName,
  onCopy,
}: ReferralShareCardProps): ReactElement {
  if (state.kind === "loading") {
    return h(
      "section",
      { "aria-busy": true, "aria-label": "Referral sharing" },
      "Preparing your referral link…",
    );
  }
  if (state.kind === "denied" || state.kind === "error") {
    return h(
      "section",
      { "aria-label": "Referral sharing", role: "alert" },
      h("h2", null, programName ?? "Refer friends"),
      h("p", null, state.message),
      state.retry ? h("button", { onClick: state.retry, type: "button" }, "Retry") : null,
    );
  }
  return h(
    "section",
    { "aria-label": "Referral sharing", "data-state": "ready" },
    h("h2", null, programName ?? "Refer friends"),
    h(
      "p",
      null,
      "Share this link. Your friend must sign up on their own; nothing else is required.",
    ),
    h("p", null, `Expires ${state.expiresAt.toISOString()}`),
    h("p", null, h("a", { href: state.shareHref }, state.shareHref)),
    onCopy
      ? h("button", { onClick: () => onCopy(state.shareHref), type: "button" }, "Copy link")
      : null,
  );
}

function benefitLabel(benefit: ReferralBenefit): string {
  if (benefit.kind === "trial-credits") {
    return `${benefit.creditAmount} trial credits${benefit.walletKey ? ` to ${benefit.walletKey}` : ""}`;
  }
  return "Progress tracking only (no benefit)";
}

export type ReferralProgressState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied"; message: string; retry?: () => void }>
  | Readonly<{ kind: "error"; message: string; retry?: () => void }>
  | Readonly<{
      kind: "ready";
      attribution: ReferralAttribution;
      referrerBenefit: ReferralBenefit;
      recipientBenefit: ReferralBenefit;
      funnel: ReferralFunnelCounts;
    }>;

export type ReferralProgressProps = Readonly<{
  state: ReferralProgressState;
  role: "referrer" | "recipient";
}>;

const STATE_LABEL: Record<ReferralAttribution["state"], string> = {
  claimed: "Claimed, awaiting qualification",
  qualified: "Qualified",
  "benefits-pending": "Granting benefits",
  "benefits-partial": "One benefit granted",
  fulfilled: "Both benefits granted",
  held: "Held for review",
  rejected: "Not eligible",
  expired: "Expired",
  indeterminate: "Confirming grant",
};

/** Customer-facing referral progress. Shows one attribution only, without recipient identity. */
export function ReferralProgress({ state, role }: ReferralProgressProps): ReactElement {
  if (state.kind === "loading") {
    return h(
      "section",
      { "aria-busy": true, "aria-label": "Referral progress" },
      "Loading referral progress…",
    );
  }
  if (state.kind === "denied" || state.kind === "error") {
    return h(
      "section",
      { "aria-label": "Referral progress", role: "alert" },
      h("p", null, state.message),
      state.retry ? h("button", { onClick: state.retry, type: "button" }, "Retry") : null,
    );
  }
  const benefit = role === "referrer" ? state.referrerBenefit : state.recipientBenefit;
  const detail =
    state.attribution.state === "held"
      ? `Held: ${state.attribution.holdReason ?? "duplicate-claim"}. Only the first valid referral counts.`
      : state.attribution.state === "rejected"
        ? `Not eligible: ${state.attribution.rejectReason ?? "existing-customer"}.`
        : state.attribution.state === "expired"
          ? "This referral expired before qualification."
          : state.attribution.state === "indeterminate"
            ? "The grant is being confirmed. Your reserved budget stays held meanwhile."
            : benefitLabel(benefit);
  return h(
    "section",
    { "aria-label": "Referral progress", "data-state": state.attribution.state },
    h("h2", null, role === "referrer" ? "Your referral" : "Your referred reward"),
    h("p", { role: "status" }, STATE_LABEL[state.attribution.state]),
    h("p", null, detail),
    h(
      "p",
      null,
      `${state.funnel.qualified} qualified · ${state.funnel.fulfilled} fulfilled in this program view`,
    ),
  );
}

export type ReferralClaimLandingState =
  | Readonly<{ kind: "loading" }>
  | Readonly<{ kind: "denied"; message: string; retry?: () => void }>
  | Readonly<{ kind: "error"; message: string; retry?: () => void }>
  | Readonly<{
      kind: "ready";
      inviterLabel: string;
      recipientBenefit: ReferralBenefit;
      qualifyingAction: string;
      conversionDeadline: Date;
      programEnded: boolean;
    }>;

export type ReferralClaimLandingProps = Readonly<{
  state: ReferralClaimLandingState;
  onAccept?: () => void;
  onDecline?: () => void;
}>;

/**
 * Recipient-facing claim landing. Presents who invited them (a display label
 * supplied by the server, never raw PII) plus the exact qualifying action and
 * deadline. Signup and qualification evidence always come from the app's own
 * authoritative server source after this screen.
 */
export function ReferralClaimLanding({
  state,
  onAccept,
  onDecline,
}: ReferralClaimLandingProps): ReactElement {
  if (state.kind === "loading") {
    return h(
      "section",
      { "aria-busy": true, "aria-label": "Referral invitation" },
      "Loading referral invitation…",
    );
  }
  if (state.kind === "denied" || state.kind === "error") {
    return h(
      "section",
      { "aria-label": "Referral invitation", role: "alert" },
      h("p", null, state.message),
      state.retry ? h("button", { onClick: state.retry, type: "button" }, "Retry") : null,
    );
  }
  if (state.programEnded) {
    return h(
      "section",
      { "aria-label": "Referral invitation", "data-state": "ended" },
      h("h2", null, "This referral program ended"),
      h("p", null, "The invitation can no longer be claimed."),
    );
  }
  const actionable = onAccept !== undefined || onDecline !== undefined;
  return h(
    "section",
    { "aria-label": "Referral invitation", "data-state": "ready" },
    h("h2", null, `${state.inviterLabel} invited you`),
    h("p", null, `Your reward: ${benefitLabel(state.recipientBenefit)}`),
    h(
      "p",
      null,
      `Qualify by completing “${state.qualifyingAction}” before ${state.conversionDeadline.toISOString()}.`,
    ),
    h(
      "p",
      null,
      "Only the first valid referral counts; signing up does not join any organization.",
    ),
    actionable
      ? h(
          "div",
          null,
          onAccept ? h("button", { onClick: onAccept, type: "button" }, "Accept invitation") : null,
          onDecline ? h("button", { onClick: onDecline, type: "button" }, "Decline") : null,
        )
      : null,
  );
}
