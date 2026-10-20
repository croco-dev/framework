import React, { Suspense } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import Counter from "./Counter";
import { productPage } from "../performance/Pdp";
export { resetLabCache, imagePath, exposeLab } from "../performance/runtime";

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

export default async function handler(request: Request): Promise<Response> {
  if (new URL(request.url).pathname.startsWith("/products/")) {
    const { node } = await productPage(request);
    return new Response(renderToReadableStream(node), {
      headers: { "content-type": "text/x-component; charset=utf-8" },
    });
  }
  const stream = renderToReadableStream(<RscPage />);
  return new Response(stream, {
    headers: { "content-type": "text/x-component; charset=utf-8" },
  });
}
