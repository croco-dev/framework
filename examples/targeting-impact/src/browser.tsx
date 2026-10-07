import * as React from "react";
import { createRoot } from "react-dom/client";
import { TargetingImpactInspector } from "@croco/admin-react";
import type { TargetingImpactInspectorState } from "@croco/admin-react";
import type { CampaignReplayResult, TargetingImpactReport } from "@croco/admin-core";

const fixture = new URLSearchParams(location.search).get("state") ?? "ready";
async function call(path: string, body: object): Promise<unknown> {
  const response = await fetch(`${path}?state=${encodeURIComponent(fixture)}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const result = await response.json();
  if (!response.ok) throw result;
  return result;
}
function App() {
  const [state, setState] = React.useState<TargetingImpactInspectorState>({ kind: "loading" });
  const [saved, setSaved] = React.useState<string>();
  const [notice, setNotice] = React.useState("");
  function fail(error: unknown) {
    const problem = error as { status?: number; code?: string };
    setState(
      problem.status === 403
        ? { kind: "denied" }
        : { kind: "error", code: problem.code ?? "REQUEST_FAILED" },
    );
  }
  async function compare(unknownPolicy: "preserve" | "exclude") {
    setState({ kind: "loading" });
    setSaved(undefined);
    setNotice("");
    try {
      const result = (await call("/compare", { unknownPolicy })) as CampaignReplayResult;
      if (!result.sourceCoverage.memberN) setState({ kind: "empty" });
      else if (!result.report)
        setState({ kind: "unavailable", missingHistoryN: result.sourceCoverage.missingHistoryN });
      else
        setState({
          kind:
            result.status === "partial" ||
            result.report.result.unknownN > 0 ||
            result.report.result.observedCostSaved.status !== "available" ||
            result.report.result.scenarioValues.some((scenario) => scenario.status !== "available")
              ? "partial"
              : "ready",
          report: result.report,
          campaignCoverage: result.sourceCoverage,
        });
    } catch (error) {
      fail(error);
    }
  }
  React.useEffect(() => {
    void compare("preserve");
  }, []);
  async function save() {
    if (state.kind !== "ready" && state.kind !== "partial") return;
    const unknownPolicy = state.report.input.definition.unknownPolicy;
    const previous = state;
    setState({ kind: "loading" });
    try {
      const report = (await call("/save", { unknownPolicy })) as TargetingImpactReport;
      const loaded = (await call("/get", { id: report.inputHash })) as TargetingImpactReport;
      setSaved(loaded.inputHash);
      setState({ ...previous, report: loaded });
      setNotice("Saved and re-read the immutable report.");
    } catch (error) {
      fail(error);
    }
  }
  async function exportReport() {
    if (!saved) return;
    try {
      const report = await call("/export", { id: saved });
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(report, null, 2)], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `targeting-impact-${saved}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setNotice("Exported the saved aggregate report.");
    } catch (error) {
      fail(error);
    }
  }
  return (
    <main>
      <header>
        <p className="eyebrow">CROCO / LOCAL SYNTHETIC EVIDENCE</p>
        <h1>Compare targeting filters</h1>
        <p>Ready fixture: 100 historical subjects · 20 excluded · 10 KRW per observed dispatch</p>
        <p>
          Fixture: <strong>{fixture}</strong>. Synthetic observations demonstrate contracts, not
          real campaign performance.
        </p>
      </header>
      <TargetingImpactInspector
        state={state}
        onReplay={(policy) => {
          void compare(policy);
        }}
        onExport={
          saved
            ? () => {
                void exportReport();
              }
            : undefined
        }
      />
      {(state.kind === "ready" || state.kind === "partial") && (
        <button
          onClick={() => {
            void save();
          }}
        >
          Save and re-read report
        </button>
      )}
      <p role="status">{notice}</p>
      <footer>
        In-memory local report storage resets when the server restarts. No messages are sent.
      </footer>
    </main>
  );
}
const root = document.getElementById("root");
if (!root) throw new TypeError("Missing application root");
createRoot(root).render(<App />);
