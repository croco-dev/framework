import { createRoot } from "react-dom/client";
import { useEffect, useState } from "react";
import { EnrichmentReviewConsole } from "@croco/admin-react";
import type { EnrichmentConsoleState } from "@croco/admin-react";
import type { EnrichmentPage } from "@croco/analytics-core/enrichment";

async function api<T>(action?: string, payload: unknown = {}, offset = 0): Promise<T> {
  const runQuery = new URL(location.href).searchParams.get("run") === "large" ? "run=large&" : "";
  const response = await fetch(
    action ? (runQuery ? `/api?${runQuery}` : "/api") : `/api?${runQuery}offset=${offset}`,
    action
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action, payload }),
        }
      : undefined,
  );
  if (!response.ok) throw new Error("Enrichment operation failed");
  return response.json() as Promise<T>;
}
function App() {
  const [state, setState] = useState<EnrichmentConsoleState>({ status: "loading" });
  useEffect(() => {
    const display = new URL(location.href).searchParams.get("state");
    if (
      display === "loading" ||
      display === "denied" ||
      display === "error" ||
      display === "empty"
    ) {
      setState({ status: display });
      return;
    }
    void api<EnrichmentPage>()
      .then((page) => setState({ status: page.status === "partial" ? "partial" : "ready", page }))
      .catch(() => setState({ status: "error" }));
  }, []);
  return (
    <EnrichmentReviewConsole
      scopeKey="synthetic-local-permission-1"
      state={state}
      definitions={["v1", "v2"].map((version) => ({
        version,
        labels: [
          { id: "support", label: "Support request" },
          { id: "purchase", label: "Purchase intent" },
        ],
      }))}
      canReview
      canClassify
      canExport
      onClassify={(itemId, version) => api("classify", { itemId, version })}
      onReview={(input) => api("review", input)}
      onExport={(input) => api("export", input)}
      onRetry={(input) => api("retry", input)}
      onLoad={(offset) => api(undefined, {}, offset)}
      onSettle={() => api("settle")}
    />
  );
}
const element = document.getElementById("app");
if (element) createRoot(element).render(<App />);
