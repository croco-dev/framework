import { createElement as h } from "react";
import type { ReactElement } from "react";
import type { OfferClaimState, OfferQuote } from "@croco/promotions-core";

export type OfferCardState =
  | Readonly<{ kind: "exposed"; quote: OfferQuote }>
  | Readonly<{ kind: "quoted"; quote: OfferQuote }>
  | Readonly<{ kind: "reserved"; quote: OfferQuote }>
  | Readonly<{ kind: "fulfilling"; quote: OfferQuote }>
  | Readonly<{ kind: "fulfilled"; quote: OfferQuote; grantRef: string }>
  | Readonly<{ kind: "expired"; quote: OfferQuote; reason: string }>
  | Readonly<{ kind: "rejected"; quote: OfferQuote; reason: string }>
  | Readonly<{ kind: "indeterminate"; quote: OfferQuote }>
  | Readonly<{ kind: "denied"; quote: OfferQuote; reason: string }>
  | Readonly<{ kind: "unavailable"; quote: OfferQuote; reason: string }>;

export type OfferCardProps = Readonly<{
  state: OfferCardState;
  onAccept?: (quote: OfferQuote) => void;
  onReject?: (quote: OfferQuote) => void;
}>;

const STATE_LABEL: Record<OfferClaimState | "exposed" | "quoted", string> = {
  exposed: "Available offer",
  quoted: "Quoted offer",
  reserved: "Reserved",
  fulfilling: "Granting benefit",
  fulfilled: "Benefit granted",
  expired: "Expired",
  rejected: "Declined",
  indeterminate: "Confirming grant",
};

function benefitSummary(quote: OfferQuote): string {
  const benefit = quote.benefit;
  if (benefit.kind === "trial-credits") {
    return `${quote.faceAmount} trial credits${benefit.walletKey ? ` to ${benefit.walletKey}` : ""}`;
  }
  return `${quote.currency ?? ""} discount up to ${quote.faceAmount} minor units`.trim();
}

function benefitTerms(quote: OfferQuote): readonly string[] {
  const benefit = quote.benefit;
  if (benefit.kind === "trial-credits") {
    return [
      `Amount: ${quote.faceAmount} credits`,
      `Valid until ${quote.expiresAt.toISOString()}`,
      benefit.expiresAt
        ? `Grant expires ${benefit.expiresAt.toISOString()}`
        : "Grant has no expiry",
    ];
  }
  return [
    `Maximum discount: ${quote.faceAmount} ${quote.currency ?? ""}`.trim(),
    `Valid until ${quote.expiresAt.toISOString()}`,
    benefit.supportedProviders.length === 0
      ? "No provider supports this discount yet"
      : `Supported providers: ${benefit.supportedProviders.join(", ")}`,
  ];
}

/** Customer-facing offer card showing real terms, validity, and a decline path. */
export function OfferCard({ state, onAccept, onReject }: OfferCardProps): ReactElement {
  if (state.kind === "denied") {
    return h(
      "section",
      { "aria-label": "Offer unavailable", role: "alert" },
      h("p", null, state.reason),
    );
  }
  if (state.kind === "unavailable") {
    return h(
      "section",
      { "aria-label": "Unsupported benefit", "data-state": "unavailable" },
      h("h2", null, benefitSummary(state.quote)),
      h("p", null, state.reason),
      h("p", null, "This benefit cannot be selected until a provider implements it."),
    );
  }
  const quote = state.quote;
  const actionable = state.kind === "exposed" || state.kind === "quoted";
  return h(
    "section",
    { "aria-label": benefitSummary(quote), "data-state": state.kind },
    h("h2", null, benefitSummary(quote)),
    h("p", { role: "status" }, STATE_LABEL[state.kind]),
    h(
      "ul",
      null,
      benefitTerms(quote).map((term) => h("li", { key: term }, term)),
    ),
    state.kind === "fulfilled" ? h("p", null, `Grant reference: ${state.grantRef}`) : null,
    state.kind === "expired" || state.kind === "rejected" ? h("p", null, state.reason) : null,
    state.kind === "indeterminate"
      ? h("p", null, "The grant is being confirmed. Your budget stays reserved meanwhile.")
      : null,
    actionable
      ? h(
          "div",
          null,
          onAccept
            ? h("button", { onClick: () => onAccept(quote), type: "button" }, "Accept offer")
            : null,
          onReject
            ? h("button", { onClick: () => onReject(quote), type: "button" }, "Decline")
            : null,
        )
      : null,
  );
}

export type MyBenefitsEntry = Readonly<{
  quote: OfferQuote;
  state: OfferClaimState | "exposed";
  grantRef?: string;
  reason?: string;
}>;

export type MyBenefitsProps = Readonly<{
  entries: readonly MyBenefitsEntry[];
  visibleLimit?: number;
  onSelect?: (entry: MyBenefitsEntry) => void;
}>;

/** Bounded customer benefit list with one distinct state per entry. */
export function MyBenefits({
  entries,
  visibleLimit = 20,
  onSelect,
}: MyBenefitsProps): ReactElement {
  if (entries.length === 0) {
    return h("section", { "aria-label": "My benefits" }, h("p", null, "No benefits yet."));
  }
  const visible = entries.slice(0, visibleLimit);
  const overflow = entries.length - visible.length;
  return h(
    "section",
    { "aria-label": "My benefits" },
    h(
      "ul",
      null,
      visible.map((entry) =>
        h(
          "li",
          { "data-state": entry.state, key: `${entry.quote.id}:${entry.state}` },
          h(
            "button",
            {
              "aria-label": `${benefitSummary(entry.quote)}: ${STATE_LABEL[entry.state]}`,
              onClick: onSelect ? () => onSelect(entry) : undefined,
              type: "button",
            },
            benefitSummary(entry.quote),
          ),
          h("span", null, ` · ${STATE_LABEL[entry.state]}`),
          entry.grantRef ? h("span", null, ` · ${entry.grantRef}`) : null,
          entry.reason && (entry.state === "expired" || entry.state === "rejected")
            ? h("span", null, ` · ${entry.reason}`)
            : null,
        ),
      ),
    ),
    overflow > 0 ? h("p", null, `${overflow} more benefits are available.`) : null,
  );
}
