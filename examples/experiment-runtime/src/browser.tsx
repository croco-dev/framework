import * as React from "react";
import { createRoot } from "react-dom/client";
import { ExperimentConsole } from "@croco/admin-react/experiment-console";
import type {
  ExperimentConsolePreview,
  ExperimentConsoleState,
} from "@croco/admin-react/experiment-console";
import type { ExperimentAdminSnapshot } from "@croco/admin-core";

async function request<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`/api/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const value: unknown = await response.json();
  if (!response.ok)
    throw new Error(
      typeof value === "object" &&
        value !== null &&
        "message" in value &&
        typeof value.message === "string"
        ? value.message
        : "Request failed",
    );
  return value as T;
}
function App() {
  const [state, setState] = React.useState<ExperimentConsoleState>({ kind: "loading" });
  const [revision, setRevision] = React.useState("v1");
  const [revisions, setRevisions] = React.useState(["v1"]);
  const [treatment, setTreatment] = React.useState<{ message: string; failed: boolean }>();
  const [treating, setTreating] = React.useState(false);
  const [operating, setOperating] = React.useState(false);
  async function load(selected: string): Promise<void> {
    const result = await request<{ snapshot: ExperimentAdminSnapshot; revisions: string[] }>(
      "read",
      { revision: selected },
    );
    setRevision(selected);
    setRevisions(result.revisions);
    setState({ kind: "ready", snapshot: result.snapshot });
  }
  React.useEffect(() => {
    void load("v1").catch((error: unknown) =>
      setState({ kind: "error", message: error instanceof Error ? error.message : "Load failed" }),
    );
  }, []);
  return (
    <main>
      <header>
        <p className="eyebrow">Croco / Local experiment runtime</p>
        <p>
          Server-owned demo identities · local deterministic allocator · in-memory reference store
        </p>
      </header>
      <section className="panel">
        <label>
          View revision{" "}
          <select
            value={revision}
            disabled={state.kind === "loading" || operating || treating}
            onChange={(event) => {
              const selected = event.currentTarget.value;
              setState({ kind: "loading" });
              setTreatment(undefined);
              void load(selected).catch((error: unknown) =>
                setState({
                  kind: "error",
                  message: error instanceof Error ? error.message : "Load failed",
                }),
              );
            }}
          >
            {revisions.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <ExperimentConsole
          state={state}
          onReload={async () => {
            setOperating(true);
            try {
              await load(revision);
            } finally {
              setOperating(false);
            }
          }}
          onPreview={(sampleId) =>
            request<ExperimentConsolePreview>("preview", { revision, sampleId })
          }
          onCommand={async (command) => {
            setOperating(true);
            try {
              const snapshot = await request<ExperimentAdminSnapshot>("command", {
                revision: command.experimentRevision,
                action: command.action,
                expectedRevision: command.expectedRevision,
                reason: command.reason,
                idempotencyKey: command.idempotencyKey,
              });
              setState({ kind: "ready", snapshot });
            } finally {
              setOperating(false);
            }
          }}
          onConfigure={async (command) => {
            setOperating(true);
            try {
              const snapshot = await request<ExperimentAdminSnapshot>("configure", {
                revision: command.experimentRevision,
                configuration: command.configuration,
                expectedRevision: command.expectedRevision,
                reason: command.reason,
                idempotencyKey: command.idempotencyKey,
              });
              await load(snapshot.target.experimentRevision);
            } finally {
              setOperating(false);
            }
          }}
        />
      </section>
      <section className="panel" aria-label="Actual server treatment" aria-busy={treating}>
        <h2>Actual server treatment</h2>
        <p>
          Process one checkout for the server-owned subject matching the configured unit. Every
          admitted treatment records one distinct exposure.
        </p>
        <button
          disabled={treating || operating || state.kind !== "ready"}
          onClick={() => {
            setTreating(true);
            setTreatment(undefined);
            void request<Record<string, unknown>>("treat", { revision })
              .then((result) =>
                setTreatment({
                  message: `Revision ${revision}\n${JSON.stringify(result, null, 2)}`,
                  failed: result.status === "evaluation_failed" || result.status === "unavailable",
                }),
              )
              .catch((error: unknown) =>
                setTreatment({
                  message: error instanceof Error ? error.message : "Treatment failed",
                  failed: true,
                }),
              )
              .finally(() => setTreating(false));
          }}
        >
          Process demo checkout
        </button>
        {treatment && <pre role={treatment.failed ? "alert" : "status"}>{treatment.message}</pre>}
      </section>
    </main>
  );
}
const container = document.getElementById("root");
if (!container) throw new Error("Example root is missing");
createRoot(container).render(<App />);
