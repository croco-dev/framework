import { createRoot } from "react-dom/client";
import { createFromFetch } from "@vitejs/plugin-rsc/browser";

async function refresh() {
  const node = await createFromFetch(fetch(`${location.pathname}.rsc`));
  void node;
}

async function hydrate() {
  const outlet = document.getElementById("root");
  if (!outlet) {
    return;
  }
  const node = await createFromFetch(fetch(`${location.pathname}.rsc`));
  createRoot(outlet).render(node as never);
  document.querySelector("[data-testid=refresh]")?.addEventListener("click", () => {
    void refresh();
  });
}

void hydrate();
