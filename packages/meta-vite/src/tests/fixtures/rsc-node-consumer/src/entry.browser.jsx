import { hydrateRoot } from "react-dom/client";
import { createFromFetch, createFromReadableStream } from "@vitejs/plugin-rsc/browser";
import { createRscBrowserFlightHeaders, readRscInitialFlight } from "@croco/meta-vite/rsc/browser";

async function main() {
  const outlet = document.getElementById("root");
  const initial = readRscInitialFlight();
  if (!outlet || !initial) {
    throw new Error("document carries no streamed Flight payload");
  }
  const root = hydrateRoot(outlet, await createFromReadableStream(initial), {
    onRecoverableError: (error) => {
      window.__hydrationErrors = [...(window.__hydrationErrors ?? []), String(error)];
    },
  });
  window.__hydrated = true;

  document.querySelector("[data-testid=refresh]")?.addEventListener("click", async () => {
    const response = await fetch(`${location.pathname}.rsc${location.search}`, {
      headers: createRscBrowserFlightHeaders(),
    });
    if (!response.ok) {
      throw new Error(`Flight refresh failed (${response.status})`);
    }
    root.render(await createFromFetch(Promise.resolve(response)));
  });
}

void main();
