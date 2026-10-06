import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { CustomerExplorer } from "@croco/admin-react";
import type { CustomerExplorerOperations } from "@croco/admin-react";
import type { ExplorerScope } from "@croco/admin-core";

async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(
    path,
    body === undefined
      ? undefined
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
  );
  const result = await response.json();
  if (!response.ok) throw Object.assign(new Error(result.detail), { code: result.code });
  return result as T;
}
const operations: CustomerExplorerOperations = {
  getSample: (scope, id) => api("/api/sample", { scope, id }),
  timeline: (scope, sampleId, subject, options) =>
    api("/api/timeline", { scope, sampleId, subject, options }),
  notes: (scope, sampleId) => api("/api/notes", { scope, sampleId }),
  saveNote: (scope, sampleId, input) => api("/api/note", { scope, sampleId, input }),
  exportDraft: (scope, sampleId, conditions) => api("/api/draft", { scope, sampleId, conditions }),
};
const root = document.getElementById("root");
if (!root) throw new Error("Example root is missing");
const app = createRoot(root);
void api<{ scope: ExplorerScope; sampleId: string }>("/api/config")
  .then((config) =>
    app.render(
      h(
        "main",
        null,
        h("h1", null, "Customer behavior workspace"),
        h("p", null, "Synthetic customer records · PostgreSQL source and notes · Local operator"),
        h(CustomerExplorer, { ...config, operations }),
      ),
    ),
  )
  .catch((error) => app.render(h("p", { role: "alert" }, String(error))));
