import * as React from "react";
import { createRoot } from "react-dom/client";
import { ActivationCandidateExplorer } from "@croco/admin-react";
import type { ActivationReport } from "@croco/metrics-core";
import type { ActivationExplorerState, ActivationSavedReport } from "@croco/admin-core";
const state = new URL(location.href).searchParams.get("state") ?? "ready";
const endpoint = (path: string) => `${path}?state=${encodeURIComponent(state)}`;
async function load(signal: AbortSignal): Promise<ActivationExplorerState> {
  const response = await fetch(endpoint("/api/load"), { signal });
  if (!response.ok)
    return {
      kind: state === "denied" ? "denied" : "error",
      code: state === "denied" ? "activation.read" : "source-unavailable",
    };
  return response.json() as Promise<ActivationExplorerState>;
}
function App() {
  const [initial, setInitial] = React.useState<ActivationExplorerState>({ kind: "loading" });
  React.useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal)
      .then(setInitial)
      .catch(() => {
        if (!controller.signal.aborted) setInitial({ kind: "error", code: "source-unavailable" });
      });
    return () => controller.abort();
  }, []);
  return React.createElement(ActivationCandidateExplorer, {
    state: initial,
    load,
    canWrite: state !== "denied",
    save: async (
      candidateId: string,
      cohort: "new" | "returning",
      expectedReport: ActivationReport,
      signal: AbortSignal,
    ): Promise<ActivationSavedReport> => {
      const response = await fetch(endpoint("/api/save"), {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ candidateId, cohort, expectedReport }),
      });
      if (!response.ok) throw new Error("Report save failed");
      return response.json() as Promise<ActivationSavedReport>;
    },
    exportSaved: async (id: string, signal: AbortSignal) => {
      const response = await fetch(`${endpoint("/api/export")}&id=${encodeURIComponent(id)}`, {
        signal,
      });
      if (!response.ok) throw new Error("Report export failed");
      return response.text();
    },
  });
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing application root");
createRoot(root).render(React.createElement(App));
