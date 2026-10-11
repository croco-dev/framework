import { useCallback, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { RetentionWorkbench } from "@croco/admin-react";
import type {
  RetentionWorkbenchState,
  RetentionDrilldownPage,
  RetentionSavedView,
} from "@croco/admin-core";

function App() {
  const [mode, setMode] = useState("ready");
  const [state, setState] = useState<RetentionWorkbenchState>({ kind: "loading" });
  const [drilldown, setDrilldown] = useState<RetentionDrilldownPage>();
  const [drilldownState, setDrilldownState] = useState<"loading" | "denied" | "error" | "stale">();
  const [message, setMessage] = useState("");
  const reload = useCallback(async () => {
    setState({ kind: "loading" });
    setDrilldown(undefined);
    setDrilldownState(undefined);
    try {
      const response = await fetch("/api/load?mode=" + mode);
      setState((await response.json()) as RetentionWorkbenchState);
    } catch {
      setState({ kind: "error", code: "retention-demo/network-failed" });
    }
  }, [mode]);
  useEffect(() => {
    void reload();
  }, [reload]);
  async function inspect(id: string, offset: number, inputToken: string) {
    setDrilldownState("loading");
    try {
      const response = await fetch(
        "/api/drilldown?" +
          new URLSearchParams({ mode, selection: id, offset: String(offset), token: inputToken }),
      );
      if (!response.ok) {
        const problem = (await response.json()) as { code: string };
        setDrilldownState(
          response.status === 403
            ? "denied"
            : problem.code === "admin-core/retention-stale-input"
              ? "stale"
              : "error",
        );
        return;
      }
      setDrilldown((await response.json()) as RetentionDrilldownPage);
      setDrilldownState(undefined);
    } catch {
      setDrilldownState("error");
    }
  }
  async function save() {
    if (!("snapshot" in state)) return;
    const response = await fetch(
      "/api/save?" + new URLSearchParams({ mode, token: state.snapshot.inputToken }),
      { method: "POST" },
    );
    setMessage(response.ok ? "Weekly view saved." : "Could not save weekly view.");
  }
  async function openSaved() {
    const response = await fetch("/api/saved?mode=" + mode);
    if (!response.ok) {
      setMessage("Saved view access failed.");
      return;
    }
    const record = (await response.json()) as RetentionSavedView | null;
    if (!record) {
      setMessage("No saved weekly view.");
      return;
    }
    setMode(record.request.sourceRef ?? "ready");
    setState({ kind: "ready", snapshot: record.snapshot });
    setDrilldown(undefined);
    setMessage("Saved weekly view opened.");
  }
  return (
    <main>
      <header>
        <p className="eyebrow">Reports · Value action</p>
        <h1>Behavior retention</h1>
        <p>
          Compare returning subjects with the prior period, inspect first behavior cohorts, and
          distinguish repeated actions from active days.
        </p>
      </header>
      <nav aria-label="Observation controls">
        <label>
          Observation{" "}
          <select value={mode} onChange={(event) => setMode(event.target.value)}>
            {["ready", "empty", "provisional", "insufficient", "denied", "error"].map((value) => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </label>
        <button onClick={() => void reload()}>Reload</button>
        <button disabled={!("snapshot" in state)} onClick={() => void save()}>
          Save weekly view
        </button>
        <button onClick={() => void openSaved()}>Open saved view</button>
      </nav>
      <p role="status">{message}</p>
      <RetentionWorkbench
        state={state}
        onReload={() => void reload()}
        onSelectMetric={(id, token) => void inspect(id, 0, token)}
        onNextPage={(id, offset, token) => void inspect(id, offset, token)}
        drilldown={drilldown}
        drilldownState={drilldownState}
      />
    </main>
  );
}
const root = document.getElementById("root");
if (root) createRoot(root).render(<App />);
