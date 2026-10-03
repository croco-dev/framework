import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { GrowthAnalysisPanel } from "@croco/admin-react";
import type { AnalysisOutcome, AnalysisProposal } from "@croco/analytics-core";

async function invoke<T>(path: string, input: unknown, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${path}${location.search}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
    signal,
  });
  if (!response.ok) {
    const details = (await response.json()) as { code?: string };
    throw Object.assign(new Error("Analysis unavailable"), { code: details.code });
  }
  return response.json() as Promise<T>;
}
const root = document.getElementById("root");
if (!root) throw new Error("Example root unavailable");
createRoot(root).render(
  h(GrowthAnalysisPanel, {
    propose: (question, signal) => invoke<AnalysisProposal>("/propose", question, signal),
    execute: (plan, signal) => invoke<AnalysisOutcome>("/execute", plan, signal),
  }),
);
