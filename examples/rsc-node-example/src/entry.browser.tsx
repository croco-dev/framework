// The browser bundle imports the Flight negotiation contract from the
// browser entrypoint: the package root is a server entry (Node builtins), so
// only this subpath can be bundled for the client.
import { createRscBrowserFlightHeaders } from "@croco/meta-vite/rsc/browser";
import { hydrateRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { createFromFetch } from "@vitejs/plugin-rsc/browser";

// `#root` already contains the server-rendered HTML, so attach with
// `hydrateRoot` instead of `createRoot`: the latter throws the DOM away and
// rebuilds it, which would never prove hydration works.
let root: Root | undefined;

async function loadFlightNode() {
  // The document carries the client manifest version it was rendered with;
  // the server refuses a Flight request that echoes a different one, so a
  // browser running an older build fails here instead of rendering a tree it
  // cannot resolve. Refusing is `createRscBrowserFlightHeaders`'s job.
  const response = await fetch(`${location.pathname}.rsc`, {
    headers: createRscBrowserFlightHeaders(),
  });

  if (!response.ok) {
    // A stale document is answered with a JSON Problem, not Flight rows, so it
    // must never reach the decoder: it would throw an unrelated parse error
    // and leave the click handler with a rejected promise.
    throw new Error(`Flight request failed (${response.status})`);
  }

  return (await createFromFetch(Promise.resolve(response))) as never;
}

async function refresh() {
  if (!root) {
    return;
  }
  // Render the newly decoded Flight node into the same root so a refresh
  // actually reaches the screen instead of dropping the payload. A failure
  // (a stale manifest, or a transport error) has to be visible: dropping the
  // rejected promise would leave the page silently stale.
  try {
    root.render(await loadFlightNode());
  } catch (error) {
    const outlet = document.getElementById("root");
    if (outlet) {
      outlet.setAttribute("data-rsc-refresh-error", "stale-manifest");
    }
    console.error("Flight refresh failed", error);
  }
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
