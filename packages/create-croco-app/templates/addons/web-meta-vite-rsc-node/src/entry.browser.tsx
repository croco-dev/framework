import { hydrateRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { createFromFetch, createFromReadableStream } from "@vitejs/plugin-rsc/browser";
import { createRscBrowserFlightHeaders, readRscInitialFlight } from "@croco/meta-vite/rsc/browser";

async function loadFlight(): Promise<ReactNode> {
  const response = await fetch(`${location.pathname}.rsc${location.search}`, {
    headers: createRscBrowserFlightHeaders(),
  });
  if (!response.ok) {
    throw new Error(`Flight request failed (${response.status})`);
  }
  return createFromFetch<ReactNode>(Promise.resolve(response));
}

async function hydrate(): Promise<void> {
  const outlet = document.getElementById("root");
  if (!outlet) {
    return;
  }
  // The document embeds the Flight bytes its HTML came from; hydrating from
  // them avoids rendering the page a second time.
  const initial = readRscInitialFlight();
  const node = initial ? await createFromReadableStream<ReactNode>(initial) : await loadFlight();
  hydrateRoot(outlet, node);
}

void hydrate();
