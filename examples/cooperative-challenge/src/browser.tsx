import { createRoot } from "react-dom/client";
import { useMemo, useState } from "react";
import { JoinChallenge } from "@croco/frontend-react";
import { ChallengeConsole } from "@croco/admin-react";
import { RequestProblem, RequestDeniedProblem } from "./RequestProblem";
import type { JoinChallengeSource, GroupProgressState } from "@croco/frontend-react";
import type { ChallengeOperationsDefinition, ChallengeOperationsSource } from "@croco/admin-core";
import type { ChallengeView } from "@croco/gamification-core";

const subject = new URLSearchParams(location.search).get("subject") ?? "member-a";
async function request(
  path: string,
  body?: unknown,
  identity = subject,
): Promise<ChallengeView | null> {
  const response = await fetch(`/api/${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { "content-type": "application/json", "x-example-subject": identity },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const result = (await response.json()) as ChallengeView & { code?: string; detail?: string };
  if (response.status === 404 && result.code === "gamification-core/challenge-not-found")
    return null;
  if (response.status === 403)
    throw new RequestDeniedProblem(result.detail ?? "Challenge access is denied");
  if (!response.ok)
    throw new RequestProblem(result.detail ?? `Request failed (${response.status})`, {
      status: response.status,
      code: result.code,
    });
  return {
    ...result,
    challenge: {
      ...result.challenge,
      start: new Date(result.challenge.start),
      end: new Date(result.challenge.end),
      finalizedAt:
        result.challenge.finalizedAt === null ? null : new Date(result.challenge.finalizedAt),
    },
    self:
      result.self === null
        ? null
        : {
            ...result.self,
            intervals: result.self.intervals.map((interval) => ({
              joinedAt: new Date(interval.joinedAt),
              leftAt: interval.leftAt === null ? null : new Date(interval.leftAt),
            })),
          },
  };
}
const initialDefinition: ChallengeOperationsDefinition = {
  scope: { app: "cooperative-example", environment: "local", tenantId: "synthetic-team" },
  id: "team-learning",
  version: 1,
  start: new Date(Date.now() + 60_000),
  end: new Date(Date.now() + 30 * 60_000),
  goal: 4,
  memberCap: 2,
  minMembers: 2,
  lateAllowanceMs: 60_000,
  visibility: "aggregate",
  leavePolicy: "retain",
};
function App() {
  const [epoch, setEpoch] = useState(0);
  const [current, setCurrent] = useState<ChallengeView | null>(null);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);
  const receiptKey = `cooperative-example:local:synthetic-team:${subject}:pending-learning`;
  const [pendingReceipt, setPendingReceipt] = useState<string | null>(() =>
    sessionStorage.getItem(receiptKey),
  );
  const participation = useMemo<JoinChallengeSource>(() => {
    const state = (view: ChallengeView | null): GroupProgressState => {
      setCurrent(view);
      return view
        ? {
            kind: view.pendingEvidenceCount > 0 ? "partial" : "ready",
            view,
            ...(view.pendingEvidenceCount > 0
              ? {
                  message:
                    "Verification is unresolved. Retry the pending activity before settlement.",
                }
              : {}),
          }
        : { kind: "empty" };
    };
    return {
      load: async () => {
        try {
          return state(await request("challenge"));
        } catch (cause) {
          if (cause instanceof RequestDeniedProblem)
            return { kind: "denied", message: cause.message };
          throw cause;
        }
      },
      join: async (command) => state(await request("join", command)),
      leave: async (command) => state(await request("leave", command)),
    };
  }, [epoch]);
  const operations = useMemo<ChallengeOperationsSource>(() => {
    const state = (view: ChallengeView | null) =>
      view
        ? { kind: view.pendingEvidenceCount > 0 ? ("partial" as const) : ("ready" as const), view }
        : { kind: "empty" as const };
    return {
      load: async () => {
        try {
          return state(await request("challenge", undefined, "operator"));
        } catch (cause) {
          if (cause instanceof RequestDeniedProblem)
            return { kind: "denied", message: cause.message };
          throw cause;
        }
      },
      save: async (command) => {
        const result = await request("save", command, "operator");
        setEpoch((value) => value + 1);
        return state(result);
      },
      close: async (command) => {
        const result = await request("close", command, "operator");
        setEpoch((value) => value + 1);
        return state(result);
      },
    };
  }, []);
  const joined = current?.self?.intervals.some((interval) => interval.leftAt === null) ?? false;
  const learn = async () => {
    if (pending) return;
    setPending(true);
    setError(undefined);
    try {
      const key = pendingReceipt ?? crypto.randomUUID();
      sessionStorage.setItem(receiptKey, key);
      setPendingReceipt(key);
      await request("learn", { idempotencyKey: key });
      sessionStorage.removeItem(receiptKey);
      setPendingReceipt(null);
      setEpoch((value) => value + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Learning contribution failed");
      if (
        cause instanceof RequestProblem &&
        cause.response !== undefined &&
        cause.response.status >= 400 &&
        cause.response.status < 500 &&
        [
          "gamification-core/challenge-invalid",
          "gamification-core/challenge-conflict",
          "gamification-core/challenge-evidence",
          "gamification-core/challenge-not-found",
        ].includes(cause.response.code ?? "")
      ) {
        sessionStorage.removeItem(receiptKey);
        setPendingReceipt(null);
        setEpoch((value) => value + 1);
      }
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <h1>Learn together</h1>
      <p>Complete four learning activities as a team. Each member can contribute up to two.</p>
      <nav aria-label="Synthetic identities">
        <a href="/?subject=member-a">Member A</a> · <a href="/?subject=member-b">Member B</a> ·{" "}
        <a href="/?subject=operator">Operator</a>
      </nav>
      <p>
        Current synthetic identity: {subject}. PostgreSQL stores membership, verified activity and
        challenge receipts.
      </p>
      {subject === "operator" ? (
        <ChallengeConsole
          scopeKey="synthetic-team"
          actor="operator"
          permissions={["challenge.read", "challenge.write", "challenge.close"]}
          source={operations}
          initialDefinition={initialDefinition}
        />
      ) : (
        <>
          <JoinChallenge scopeKey={`synthetic-team:${subject}`} source={participation} />
          <section aria-label="Learning activity" aria-busy={pending}>
            <h2>Learning activity</h2>
            <p>This local action writes a server receipt before the challenge verifies it.</p>
            {error && <p role="alert">{error}</p>}
            <button
              type="button"
              disabled={
                pending ||
                !current ||
                (!pendingReceipt &&
                  (!joined ||
                    current.challenge.state !== "active" ||
                    current.pendingEvidenceCount > 0))
              }
              onClick={() => void learn()}
            >
              {pendingReceipt ? "Retry learning contribution" : "Complete learning activity"}
            </button>
          </section>
        </>
      )}
    </>
  );
}
const root = document.getElementById("root");
if (!root) throw new RequestProblem("Application root is required");
createRoot(root).render(<App />);
