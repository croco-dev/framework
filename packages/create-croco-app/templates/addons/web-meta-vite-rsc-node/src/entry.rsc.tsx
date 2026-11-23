import { Suspense } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { defineRscServerEntry } from "@croco/meta-vite/rsc/server";
import type { RenderRouteComponentProps } from "@croco/meta-vite";
import Counter from "./Counter";

async function ServerTime() {
  // Stands in for a data source: the page streams before this resolves.
  await new Promise((resolve) => setTimeout(resolve, 20));
  return <p data-croco-smoke="server-time">Rendered on the server at {new Date().toISOString()}</p>;
}

function HomePage({ request }: RenderRouteComponentProps) {
  return (
    <main>
      <h1>Croco RSC on Node</h1>
      <p>Path: {new URL(request.url).pathname}</p>
      <Suspense fallback={<p>Loading server data…</p>}>
        <ServerTime />
      </Suspense>
      <Counter />
    </main>
  );
}

export default defineRscServerEntry({
  renderToReadableStream,
  routes: [{ path: "/", component: HomePage, head: () => ({ title: "Croco RSC" }) }],
});
