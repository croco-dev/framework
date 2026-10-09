import { createElement as h, useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { CancellationFlow } from "@croco/frontend-react";
import { RetentionOfferConsole } from "@croco/admin-react";
import { CancellationInputProblem } from "@croco/billing-core/cancellation";
import type { CancellationSession, CancellationSnapshot } from "@croco/billing-core/cancellation";
import type { CancellationFlowState } from "@croco/frontend-react";
import type { RetentionOfferConsoleState, RetentionOfferView } from "@croco/admin-core";

async function request<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw result;
  return result as T;
}

function App() {
  const admin = location.pathname === "/retention";
  const [state, setState] = useState<CancellationFlowState>({ kind: "loading" });
  const [consoleState, setConsoleState] = useState<RetentionOfferConsoleState>({ kind: "loading" });
  const [starting, setStarting] = useState(false);
  const [startError, setStartError] = useState<string>();
  const refresh = useCallback(async () => {
    if (admin) {
      const view = await request<RetentionOfferView>("/api/retention");
      setConsoleState({ kind: "ready", view });
    } else {
      const session = await request<CancellationSession>("/api/session");
      setState({ kind: "ready", session });
    }
  }, [admin]);
  useEffect(() => {
    void refresh().catch(() =>
      admin
        ? setConsoleState({ kind: "error", code: "Could not load the current policy" })
        : setState({ kind: "error", code: "Could not load the current subscription" }),
    );
  }, [admin, refresh]);
  return h(
    "div",
    null,
    h(
      "p",
      { className: "sandbox" },
      "Local sandbox · synthetic subscription and provider · no real payments",
    ),
    h(
      "nav",
      null,
      h("a", { href: "/" }, "Subscription"),
      " · ",
      h("a", { href: "/retention" }, "Retention policy"),
    ),
    admin
      ? h(RetentionOfferConsole, {
          state: consoleState,
          canWrite: true,
          onSave: async (edit) => {
            await request("/api/retention", edit);
            await refresh();
          },
          onRefresh: refresh,
        })
      : h(CancellationFlow, {
          state,
          onDecide: async (decision) => {
            try {
              const session = await request<CancellationSession>("/api/decision", decision);
              setState({ kind: "ready", session });
            } catch (error) {
              // A conflict carries the fresh authoritative state; explicit refresh creates a new session.
              const result = error as { code?: string; snapshot?: CancellationSnapshot };
              if (
                result.code === "billing/cancellation-conflict" &&
                result.snapshot &&
                "session" in state
              ) {
                setState({
                  kind: "conflict",
                  session: { ...state.session, snapshot: result.snapshot },
                });
              }
              throw error;
            }
          },
          onRefresh: refresh,
          onDisplayed: async () => {
            const session = await request<CancellationSession>("/api/displayed", {});
            setState((current) =>
              "session" in current &&
              (current.session.id !== session.id || current.session.revision > session.revision)
                ? current
                : { kind: "ready", session },
            );
          },
        }),
    !admin &&
      "session" in state &&
      state.session.decision &&
      (!state.session.commandReceipt ||
        ["confirmed", "failed"].includes(state.session.commandReceipt.providerOutcome))
      ? h(
          "div",
          null,
          h(
            "button",
            {
              type: "button",
              disabled: starting,
              onClick: async () => {
                setStarting(true);
                setStartError(undefined);
                try {
                  const session = await request<CancellationSession>("/api/session/new", {});
                  setState({ kind: "ready", session });
                } catch {
                  setStartError(
                    "Could not start a new request. Refresh the current outcome and try again.",
                  );
                } finally {
                  setStarting(false);
                }
              },
            },
            "Start a new cancellation request",
          ),
          startError ? h("p", { role: "alert" }, startError) : null,
        )
      : null,
  );
}

const root = document.getElementById("root");
if (!root) throw new CancellationInputProblem("Cancellation example root is missing");
createRoot(root).render(h(App));
