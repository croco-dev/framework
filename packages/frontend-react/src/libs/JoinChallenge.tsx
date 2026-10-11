import { useEffect, useRef, useState } from "react";
import type { ReactElement } from "react";
import { GroupProgress } from "./GroupProgress";
import type { GroupProgressState } from "./GroupProgress";

export type JoinChallengeRequest = Readonly<{
  consentVersion: number;
  leavePolicy: "retain" | "remove";
  publicConsent: boolean;
  idempotencyKey: string;
}>;
export interface JoinChallengeSource {
  load(): Promise<GroupProgressState>;
  join(request: JoinChallengeRequest): Promise<GroupProgressState>;
  leave(request: Readonly<{ idempotencyKey: string }>): Promise<GroupProgressState>;
}
export type JoinChallengeProps = { scopeKey: string; source: JoinChallengeSource };
export function JoinChallenge(props: JoinChallengeProps): ReactElement {
  return <ChallengeParticipation key={props.scopeKey} {...props} />;
}
function ChallengeParticipation({ source }: JoinChallengeProps): ReactElement {
  const [state, setState] = useState<GroupProgressState>({ kind: "loading" });
  const [consent, setConsent] = useState(false);
  const [publicConsent, setPublicConsent] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string>();
  const generation = useRef(0);
  const busy = useRef(false);
  const latestSource = useRef(source);
  latestSource.current = source;
  useEffect(() => {
    const current = ++generation.current;
    busy.current = false;
    setPending(false);
    setConsent(false);
    setPublicConsent(false);
    setError(undefined);
    setState({ kind: "loading" });
    void source.load().then(
      (next) => {
        if (generation.current === current && latestSource.current === source) setState(next);
      },
      () => {
        if (generation.current === current && latestSource.current === source)
          setState({ kind: "error", message: "Unable to load challenge." });
      },
    );
    return () => {
      generation.current = current + 1;
    };
  }, [source]);
  const run = async (operation: () => Promise<GroupProgressState>) => {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const current = generation.current;
    try {
      const next = await operation();
      if (generation.current === current && latestSource.current === source) {
        setState(next);
        setError(undefined);
        setConsent(false);
        setPublicConsent(false);
      }
    } catch {
      if (generation.current === current && latestSource.current === source)
        setError("Challenge operation failed. Reload before trying again.");
    } finally {
      if (generation.current === current && latestSource.current === source) {
        busy.current = false;
        setPending(false);
      }
    }
  };
  const view = state.kind === "ready" || state.kind === "partial" ? state.view : undefined;
  const joined = view?.self?.intervals.some((interval) => interval.leftAt === null) ?? false;
  const canLeave = Boolean(view) && joined && !error && !pending;
  const mutable = state.kind === "ready" && view?.pendingEvidenceCount === 0 && !error && !pending;
  return (
    <section aria-label="Challenge participation" aria-busy={pending || state.kind === "loading"}>
      <GroupProgress state={state} />
      {error && <p role="alert">{error}</p>}
      <button
        type="button"
        disabled={pending || state.kind === "loading"}
        onClick={() => void run(() => source.load())}
      >
        Reload challenge
      </button>
      {view && (
        <>
          <p>
            Joining is optional. Only verified activity during your participation and the challenge
            period counts. Activity before joining or after leaving is excluded.
          </p>
          <p>
            {view.challenge.leavePolicy === "retain"
              ? "After leaving, previously accepted contributions remain in the group total."
              : "After leaving, previously accepted contributions are removed from the group total before finalization."}{" "}
            Finalized outcomes stay fixed. Privacy deletion removes identifying activity; finalized
            aggregate totals may remain. An opaque suppression marker remains after privacy deletion
            to prevent replay and rejoining this challenge.
          </p>
          <p>Other members see group totals. Your detailed activity is never shown here.</p>
          {joined ? (
            <button
              type="button"
              disabled={!canLeave}
              onClick={() => {
                if (canLeave) void run(() => source.leave({ idempotencyKey: crypto.randomUUID() }));
              }}
            >
              Leave challenge
            </button>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (!mutable || !consent || !["scheduled", "active"].includes(view.challenge.state))
                  return;
                void run(() =>
                  source.join({
                    consentVersion: view.challenge.version,
                    leavePolicy: view.challenge.leavePolicy,
                    publicConsent,
                    idempotencyKey: crypto.randomUUID(),
                  }),
                );
              }}
            >
              <fieldset
                disabled={!mutable || !["scheduled", "active"].includes(view.challenge.state)}
              >
                <legend>Participation consent</legend>
                <label>
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(event) => setConsent(event.target.checked)}
                  />
                  I agree to participate under the contribution and privacy policy above.
                </label>
                {view.challenge.visibility === "consented" && (
                  <label>
                    <input
                      type="checkbox"
                      checked={publicConsent}
                      onChange={(event) => setPublicConsent(event.target.checked)}
                    />
                    Optionally share my identity and contribution total with participating members.
                  </label>
                )}
                <button type="submit" disabled={!consent}>
                  Join challenge
                </button>
              </fieldset>
            </form>
          )}
        </>
      )}
    </section>
  );
}
