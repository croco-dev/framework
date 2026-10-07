import { createElement as h, useEffect, useRef, useState } from "react";
import { validateCancellationDecision } from "@croco/billing-core/cancellation";
import type { ReactElement, ChangeEvent } from "react";
import type { CancellationDecision, CancellationSession } from "@croco/billing-core";

/** Partial retains the current authorized snapshot and quote; choice availability flags identify unavailable options. */
export type CancellationFlowState =
  | Readonly<{ kind: "loading" | "empty" }>
  | Readonly<{ kind: "error" | "denied"; code: string }>
  | Readonly<{ kind: "ready" | "partial" | "conflict"; session: CancellationSession }>;
export type CancellationFlowProps = Readonly<{
  state: CancellationFlowState;
  onDecide(decision: CancellationDecision): Promise<void>;
  onRefresh(): Promise<void>;
  onDisplayed?(): Promise<void>;
}>;

export function CancellationFlow(props: CancellationFlowProps): ReactElement {
  const session = "session" in props.state ? props.state.session : undefined;
  const [declined, setDeclined] = useState(false);
  return h(CancellationFlowView, {
    ...props,
    declined,
    onDecline: () => setDeclined(true),
    key: session
      ? `${session.id}:${session.quoteRef}:${session.subscriptionRevision}`
      : props.state.kind,
  });
}

function CancellationFlowView({
  state,
  onDecide,
  onRefresh,
  onDisplayed,
  declined,
  onDecline,
}: CancellationFlowProps & Readonly<{ declined: boolean; onDecline(): void }>): ReactElement {
  const session = "session" in state ? state.session : undefined;
  const [reason, setReason] = useState("");
  const shouldRecordDisplay =
    session?.state === "open" &&
    !session.displayedAt &&
    session.choices.some((choice) => choice.action !== "cancel") &&
    !!onDisplayed;
  const [displayPending, setDisplayPending] = useState(shouldRecordDisplay);
  const [commandPending, setPending] = useState(false);
  const pending = commandPending || displayPending;
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const busy = useRef(false);
  const displayed = useRef(false);
  const cancel = useRef<HTMLButtonElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    if (shouldRecordDisplay && !displayed.current && onDisplayed) {
      displayed.current = true;
      setDisplayPending(true);
      void (async () => {
        try {
          await onDisplayed();
        } catch {
          setError("Offer display could not be recorded. Refresh before continuing.");
        } finally {
          setDisplayPending(false);
        }
      })();
    }
  }, [shouldRecordDisplay, onDisplayed]);
  useEffect(() => {
    if (error || submitted || state.kind === "conflict") status.current?.focus();
  }, [error, submitted, state.kind]);
  const run = async (operation: () => Promise<void>, deciding: boolean) => {
    if (displayPending || busy.current || (deciding && submitted)) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await operation();
      if (deciding) setSubmitted(true);
    } catch {
      setError(
        "No outcome was confirmed. Refresh the current subscription and existing command before continuing.",
      );
      setSubmitted(true);
    } finally {
      busy.current = false;
      setPending(false);
    }
  };
  const choose = (kind: CancellationDecision["kind"], choiceId?: string) => {
    if (!session) return;
    void run(async () => {
      const decision: CancellationDecision = {
        decisionId: crypto.randomUUID(),
        kind,
        ...(choiceId ? { choiceId } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      };
      validateCancellationDecision(session, decision, new Date());
      await onDecide(decision);
    }, true);
  };
  const expired =
    session?.state === "open" && Date.parse(session.snapshot.quote.expiresAt) <= now.getTime();
  const blocked =
    pending ||
    submitted ||
    !!error ||
    expired ||
    state.kind === "conflict" ||
    session?.state !== "open";
  const receipt = session?.commandReceipt;
  const outcome = receipt
    ? `${
        {
          pending:
            "Your request is being processed. A subscription change is not yet confirmed. Refresh to check the existing request.",
          confirmed: {
            none: "Your request is confirmed. No subscription change was made.",
            cancellation_scheduled: "Cancellation is scheduled. Your subscription has not ended.",
            ended: "Your subscription has ended.",
            resumed: "Your subscription has resumed.",
            plan_changed: "Your subscription plan has changed.",
          }[receipt.effect],
          failed:
            "Your request failed. A subscription change is not confirmed. Refresh to check the existing request.",
          indeterminate:
            "The result of your request is not yet known. A subscription change is not confirmed. Refresh to check the existing request.",
        }[receipt.providerOutcome]
      } ${
        {
          not_requested: "No refund has been requested.",
          pending: "Your refund is being processed; it is not yet confirmed.",
          confirmed: "Your refund is confirmed.",
          failed: "Your refund failed.",
          indeterminate:
            "The result of your refund request is not yet known. Refresh to check the existing request.",
        }[receipt.refundOutcome]
      }`
    : session?.decision?.kind === "keep_subscription"
      ? "Subscription kept. No cancellation command was sent."
      : submitted
        ? "Decision submitted. Refresh to inspect the authoritative outcome."
        : "";
  return h(
    "section",
    { "aria-label": "Cancel subscription", "aria-busy": pending, "data-state": state.kind },
    h("h2", null, "Cancel subscription"),
    state.kind === "partial"
      ? h(
          "p",
          { role: "status" },
          "Some choices are unavailable. The current subscription and quote are shown below.",
        )
      : null,
    state.kind === "loading" ? h("p", { role: "status" }, "Loading current subscription…") : null,
    state.kind === "empty"
      ? h("p", { role: "status" }, "No cancellation session is available.")
      : null,
    state.kind === "denied" || state.kind === "error"
      ? h("p", { role: "alert" }, `${state.kind}: ${state.code}`)
      : null,
    session
      ? h(
          "div",
          null,
          h(
            "p",
            null,
            `Subscription${session.state === "decided" ? " at decision" : ""}: ${{ active: "active", cancellation_scheduled: "cancellation scheduled", ended: "ended" }[session.snapshot.status]}. Started ${session.snapshot.subscriptionStartedAt}. Billing period: ${session.snapshot.billingPeriod}.`,
          ),
          h(
            "p",
            null,
            `${session.state === "decided" ? "Refund quote at decision" : "Current refund quote"}: ${session.snapshot.quote.refund}, ${session.snapshot.quote.amount} ${session.snapshot.quote.currency}. Valid until ${session.snapshot.quote.expiresAt}.`,
          ),
          h("p", null, session.choices.find((choice) => choice.action === "cancel")?.consequence),
          h(
            "button",
            {
              ref: cancel,
              type: "button",
              disabled:
                blocked ||
                !session.choices.some((choice) => choice.action === "cancel" && choice.available),
              onClick: () => choose("continue_cancel"),
            },
            "Confirm cancellation",
          ),
          h(
            "label",
            null,
            "Reason (optional)",
            h("input", {
              value: reason,
              disabled: blocked,
              onChange: (event: ChangeEvent<HTMLInputElement>) => setReason(event.target.value),
            }),
          ),
          h(
            "button",
            {
              type: "button",
              disabled: blocked,
              onClick: () => {
                setReason("");
                cancel.current?.focus();
              },
            },
            "Skip reason",
          ),
          h(
            "button",
            {
              type: "button",
              disabled: blocked || !session.keepAvailable,
              onClick: () => choose("keep_subscription"),
            },
            "Keep subscription",
          ),
          !declined && session.state === "open"
            ? h(
                "section",
                { "aria-label": "Optional retention choices" },
                session.choices
                  .filter((choice) => choice.action !== "cancel")
                  .map((choice) =>
                    h(
                      "div",
                      { key: choice.id },
                      h("h3", null, choice.label),
                      h("p", null, choice.consequence),
                      h(
                        "button",
                        {
                          type: "button",
                          disabled: blocked || !choice.available,
                          onClick: () => choose("accept_registered_offer", choice.id),
                        },
                        choice.available ? `Accept ${choice.label}` : `${choice.label} unavailable`,
                      ),
                    ),
                  ),
                h(
                  "button",
                  {
                    type: "button",
                    disabled: pending,
                    onClick: () => {
                      onDecline();
                      cancel.current?.focus();
                    },
                  },
                  "Decline offers",
                ),
              )
            : null,
          h("p", null, "Choosing an offer does not waive your cancellation or refund rights."),
        )
      : null,
    h(
      "p",
      {
        ref: status,
        tabIndex: -1,
        role: error || expired || state.kind === "conflict" ? "alert" : "status",
      },
      error ||
        (state.kind === "conflict"
          ? "Subscription or quote changed. Review fresh state before choosing again."
          : expired
            ? "Quote expired. Refresh current terms before choosing."
            : displayPending
              ? "Recording offer display…"
              : commandPending
                ? "Submitting decision…"
                : outcome),
    ),
    h(
      "button",
      {
        type: "button",
        disabled: pending,
        onClick: () =>
          void run(async () => {
            await onRefresh();
            setSubmitted(false);
          }, false),
      },
      "Refresh current state",
    ),
  );
}
