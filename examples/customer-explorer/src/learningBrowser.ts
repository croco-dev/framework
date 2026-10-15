import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { LearningWorkspace } from "@croco/admin-react";
import { LearningRegistryProblem, LearningStorageProblem } from "@croco/admin-core";
import type { LearningProblemCode, LearningRecord, LearningScope } from "@croco/admin-core";
import type { LearningWorkspaceProps } from "@croco/admin-react";

async function api<T>(name: string, data: unknown): Promise<T> {
  const response = await fetch(`/api/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const code =
      typeof result.code === "string" ? result.code.replace("learning-registry/", "") : "";
    if (
      [
        "input",
        "denied",
        "not-found",
        "revision-conflict",
        "idempotency-conflict",
        "transition",
      ].includes(code)
    )
      throw new LearningRegistryProblem(code as LearningProblemCode, "Learning operation failed");
    throw new LearningStorageProblem();
  }
  return result as T;
}
async function start(): Promise<void> {
  const config = (await (await fetch("/api/config")).json()) as {
    scope: LearningScope;
    accessRevision: string;
    draft: LearningRecord;
  };
  const root = document.getElementById("root");
  if (!root) return;
  const props: LearningWorkspaceProps = {
    ...config,
    state: { kind: "ready", draft: config.draft },
    canWrite: true,
    canExport: true,
    onSave: (command) => api("save", { command }),
    onRead: (id) => api("read", { id }),
    onSearch: (query) => api("search", { query }),
    onHistory: (id, before) => api("history", { id, before }),
    onExport: (id) => api("export", { id }),
    onCopyDraft: (id) => api("copy", { id }),
  };
  createRoot(root).render(h(LearningWorkspace, props));
}
void start().catch((error) => {
  const root = document.getElementById("root");
  if (root)
    root.textContent = error instanceof Error ? error.message : "Learning workspace unavailable";
});
