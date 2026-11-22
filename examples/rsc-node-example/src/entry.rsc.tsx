import React, { Suspense } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { defineRscServerEntry } from "@croco/meta-vite/rsc/server";
import type { RenderRouteComponentProps } from "@croco/meta-vite";
import Counter from "./Counter";
import { productPage } from "../performance/Pdp";
import { exposeLab, imagePath, resetLabCache } from "../performance/runtime";

export const SERVER_ONLY_VALUE = "RSC:server-only-value";

async function SlowFact() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return <p>slow:resolved</p>;
}

function RscPage() {
  return (
    <main>
      <h1>RSC route: hello</h1>
      <p>{SERVER_ONLY_VALUE}</p>
      {/* Plain markup: the browser entry attaches the click handler that
          fetches fresh Flight bytes and re-renders the same root. */}
      <button type="button" data-testid="refresh">
        Refresh
      </button>
      <Suspense fallback={<p>loading slow fact…</p>}>
        <SlowFact />
      </Suspense>
      <Counter />
    </main>
  );
}

async function ProductPage({ request }: RenderRouteComponentProps) {
  const { node } = await productPage(request);
  return node;
}

type ExposeInput = { receipt: string; displayInstanceId: string; occurredAt: string };

export default defineRscServerEntry({
  renderToReadableStream,
  // The performance lab reaches the same experiment bridge and cache the
  // rendered pages use, which live in this build's worker.
  actions: {
    exposeLab: (input, { request }) => exposeLab(request, input as ExposeInput),
    resetLabCache: () => resetLabCache(),
    imagePaths: () => [400, 800, 1200].map((width) => imagePath(width)),
  },
  routes: [
    { path: "/", component: RscPage, head: () => ({ title: "RSC Node Example" }) },
    { path: "/products/orbit", component: ProductPage, head: () => ({ title: "Orbit print" }) },
  ],
});
