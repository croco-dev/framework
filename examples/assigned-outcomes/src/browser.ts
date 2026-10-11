import { createElement as h, useState } from "react";
import { createRoot } from "react-dom/client";
import { NetOutcomePanel } from "@croco/admin-react";
import type { NetOutcomeRequest, NetOutcomeState } from "@croco/admin-core";
const initial: NetOutcomeRequest = {
  cutoff: { effectiveAt: "2026-09-30T00:00:00.000Z", knownAt: "2026-10-01T00:00:00.000Z" },
  revision: "1",
};
const fixture = new URL(location.href).searchParams.get("fixture") ?? "ready";
function params(request: NetOutcomeRequest) {
  return new URLSearchParams({ ...request.cutoff, revision: request.revision, fixture });
}
async function load(request: NetOutcomeRequest): Promise<NetOutcomeState> {
  return (await fetch(`/api/report?${params(request)}`)).json();
}
function App({ first }: { first: NetOutcomeState }) {
  const [state, setState] = useState(first);
  const [request, setRequest] = useState(initial);
  return h(NetOutcomePanel, {
    state,
    request,
    onRefresh: async (next) => {
      setState({ kind: "loading" });
      setRequest(next);
      try {
        setState(await load(next));
      } catch {
        setState({ kind: "error", code: "example/read-failed" });
      }
    },
    onDrilldown: async (next) => {
      const query = params(next);
      query.set("arm", next.arm);
      query.set("currency", next.currency);
      query.set("source", next.source);
      query.set("limit", String(next.limit));
      const response = await fetch(`/api/drilldown?${query}`);
      if (!response.ok) throw new Error("Drilldown failed");
      return response.json();
    },
  });
}
const root = document.getElementById("root");
if (!root) throw new Error("Missing root");
void load(initial)
  .catch((): NetOutcomeState => ({ kind: "error", code: "example/read-failed" }))
  .then((first) => createRoot(root).render(h(App, { first })));
