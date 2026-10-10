import React, { Suspense } from "react";
import { renderToReadableStream } from "@vitejs/plugin-rsc/rsc";
import Counter from "./Counter";

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
      <Suspense fallback={<p>loading slow fact…</p>}>
        <SlowFact />
      </Suspense>
      <Counter />
    </main>
  );
}

export default async function handler(request: Request): Promise<Response> {
  const stream = renderToReadableStream(<RscPage />);
  return new Response(stream, {
    headers: { "content-type": "text/x-component; charset=utf-8" },
  });
  void request;
}
