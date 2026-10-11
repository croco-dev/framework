import { createElement as h } from "react";
import { createRoot } from "react-dom/client";
import { DatasetExplorer } from "@croco/admin-react";
import type { DatasetExplorerState } from "@croco/admin-react";

const root = document.getElementById("root");
if (!root) throw new Error("Example root is missing");
const app = createRoot(root);
const query = location.search;
async function mutate(operation: string, request: unknown) {
  const response = await fetch(`/api/${operation}${query}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  if (!response.ok) throw new Error(await response.text());
}
function render(state: DatasetExplorerState) {
  app.render(
    h(
      "main",
      null,
      h("h1", null, "Warehouse publications"),
      h(
        "p",
        null,
        "Synthetic capture and search facts stored in temporary PostgreSQL. Each sample comes from a sealed, published snapshot.",
      ),
      h(
        "nav",
        { "aria-label": "Example datasets" },
        ...["captures", "search", "empty", "denied", "unavailable"].map((name) =>
          h("a", { key: name, href: `/?dataset=${name}`, style: { marginRight: 16 } }, name),
        ),
      ),
      h(DatasetExplorer, {
        state,
        actor: "demo-operator",
        canRepublish: true,
        canRemove: true,
        onRepublish: (request) => mutate("republish", request),
        onRemove: (request) => mutate("remove", request),
      }),
    ),
  );
}
render({ kind: "loading" });
void fetch(`/api/dataset${query}`)
  .then(async (response) => {
    if (!response.ok) throw new Error(await response.text());
    render((await response.json()) as DatasetExplorerState);
  })
  .catch(() => render({ kind: "unavailable" }));
