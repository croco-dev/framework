import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createFromFetch } from "@vitejs/plugin-rsc/browser";

// `#root` already contains the server-rendered HTML, so attach with
// `hydrateRoot` instead of `createRoot`: the latter throws the DOM away and
// rebuilds it, which would never prove hydration works.
let root: Root | undefined;

async function loadFlightNode() {
  return (await createFromFetch(fetch(`${location.pathname}.rsc`))) as never;
}

async function refresh() {
  if (!root) {
    return;
  }
  // Render the newly decoded Flight node into the same root so a refresh
  // actually reaches the screen instead of dropping the payload.
  root.render(await loadFlightNode());
}

async function hydrate() {
  const outlet = document.getElementById("root");
  if (!outlet) {
    return;
  }
  root = hydrateRoot(outlet, await loadFlightNode());
  document.querySelector("[data-testid=refresh]")?.addEventListener("click", () => {
    void refresh();
  });
}

void hydrate();
