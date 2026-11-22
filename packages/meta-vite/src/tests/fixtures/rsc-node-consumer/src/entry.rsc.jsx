import { Suspense } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import { defineRscServerEntry } from "@croco/meta-vite/rsc/server";
import Counter from "./Counter.jsx";
import { SERVER_ONLY_TOKEN } from "./serverOnly.js";

let renders = 0;

async function SlowFact() {
  await new Promise((resolve) => setTimeout(resolve, 50));
  return <p data-testid="slow">slow:resolved</p>;
}

function Home({ request, context }) {
  renders += 1;
  const url = new URL(request.url);
  return (
    <main>
      <h1>Packed RSC</h1>
      <p data-testid="request">
        path={url.pathname} tenant={String(context?.env?.tenant ?? "none")}
      </p>
      <p data-testid="render">render={renders}</p>
      <p data-testid="server-only">server-only-length={SERVER_ONLY_TOKEN.length}</p>
      <button type="button" data-testid="refresh">
        Refresh
      </button>
      <Suspense fallback={<p>loading</p>}>
        <SlowFact />
      </Suspense>
      <Counter />
    </main>
  );
}

export default defineRscServerEntry({
  renderToReadableStream,
  routes: [{ path: "/", component: Home, head: () => ({ title: "Packed RSC" }) }],
});
