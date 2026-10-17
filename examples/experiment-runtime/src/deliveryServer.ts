import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  ExperimentProblem,
  ExperimentDeliveryBridge,
  InMemoryExperimentDeliveryStore,
  ExperimentRuntime,
  InMemoryExperimentStore,
} from "@croco/features-core";
import { RenderServer } from "@croco/meta-vite";
import { Problem } from "@croco/problems-core";
import { DeliveryPage } from "./deliveryView";
import type { ExperimentDefinition, ExperimentDeliveryIdentity } from "@croco/features-core";

// Local fixture only. No external providers, customer identities, commands or durable data.
const scope = { app: "delivery-demo", environment: "local", tenantId: "local-tenant" };
const target = { scope, experimentId: "checkout-assurance", experimentRevision: "v1" };
const definition: ExperimentDefinition = {
  id: target.experimentId,
  revision: "v1",
  unit: "user",
  loginPolicy: "switch-unit",
  salt: "local",
  allocatorVersion: "sha256-v1",
  allocation: 10000,
  variants: [{ id: "assurance", value: "Payment protected", weight: 10000 }],
  hypothesis: "Assurance",
  observationPlan: "Checkout completion",
  eligibility: "synthetic-local",
};
async function main() {
  const store = new InMemoryExperimentStore();
  const runtime = new ExperimentRuntime({
    store,
    authorization: { authorize: (input) => input.actor === "local-server" },
  });
  await runtime.register(
    {
      definition,
      handlers: { assurance: () => "done" },
      eligibility: () => ({ status: "eligible" }),
    },
    scope,
    "local-server",
  );
  await runtime.start({
    ...target,
    actor: "local-server",
    expectedRevision: 0,
    reason: "local fixture",
    idempotencyKey: "start",
  });
  const bridge = new ExperimentDeliveryBridge({
    reader: runtime,
    store: new InMemoryExperimentDeliveryStore(),
    regions: [{ id: "checkout", target, policyRevision: "p1" }],
    ttlMs: 60000,
    evaluationTimeoutMs: 1000,
  });
  const reports: unknown[] = [];
  const server = createServer(async (incoming, outgoing) => {
    try {
      const url = new URL(incoming.url ?? "/", "http://127.0.0.1");
      // Browser bodies cannot select identity. This local cookie only selects two synthetic fixture users.
      const identity: ExperimentDeliveryIdentity = {
        scope,
        actor: "local-server",
        subject: {
          kind: "user",
          id: incoming.headers.cookie?.includes("demo-user=b") ? "local-b" : "local-a",
        },
      };
      if (url.pathname === "/browser.js") {
        outgoing.setHeader("Content-Type", "text/javascript");
        outgoing.end(await readFile(resolve("dist/deliveryBrowser.global.js")));
        return;
      }
      if (url.pathname === "/reports") {
        outgoing.setHeader("Content-Type", "application/json");
        outgoing.end(JSON.stringify(reports));
        return;
      }
      if (incoming.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const chunk of incoming) chunks.push(Buffer.from(chunk));
        const body = JSON.parse(Buffer.concat(chunks).toString()) as {
          receipt: string;
          displayInstanceId: string;
          occurredAt: string;
        };
        let result: unknown;
        if (url.pathname === "/exposure") {
          result = await bridge.expose(
            body.receipt,
            identity,
            body.displayInstanceId,
            body.occurredAt,
          );
          reports.push(result);
        } else if (url.pathname === "/admit") result = await bridge.admit(body.receipt, identity);
        else throw new ExperimentProblem("invalid", "Unknown local endpoint");
        outgoing.setHeader("Content-Type", "application/json");
        outgoing.end(JSON.stringify(result));
        return;
      }
      const headers = new Headers();
      if (incoming.headers.accept) headers.set("accept", incoming.headers.accept);
      const manifest = incoming.headers["x-croco-rsc-client-manifest"];
      if (typeof manifest === "string") headers.set("x-croco-rsc-client-manifest", manifest);
      const request = new Request(url, { headers });
      const response = await bridge.render(
        ["checkout"],
        identity,
        request,
        async (decisions) => {
          const trustedHeaders = new Headers(request.headers);
          trustedHeaders.set("x-local-delivery", JSON.stringify(decisions[0]));
          const trustedRequest = new Request(request, { headers: trustedHeaders });
          const rsc = url.pathname.startsWith("/rsc");
          const renderer = new RenderServer([
            {
              path: rsc ? "/rsc" : "/ssr",
              mode: rsc ? "rsc" : "ssr",
              componentRef: resolve("dist/deliveryView.mjs#DeliveryPage"),
              componentLoader: async () => ({ default: DeliveryPage }),
            },
          ]);
          const rendered = await renderer.handle(trustedRequest);
          if (!rendered.headers.get("content-type")?.includes("text/html")) return rendered;
          return new Response(
            (await rendered.text()).replace(
              "</body>",
              `${url.searchParams.has("hidden") ? "<style>[data-experiment-region]{display:none}</style>" : ""}<script src="/browser.js" defer></script></body>`,
            ),
            { status: rendered.status, headers: rendered.headers },
          );
        },
        url.searchParams.has("prefetch") ? "speculative" : "admitted",
      );
      outgoing.statusCode = response.status;
      response.headers.forEach((value, key) => outgoing.setHeader(key, value));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.statusCode = error instanceof Problem ? error.status : 500;
      outgoing.end(error instanceof Problem ? error.message : "Local delivery failed");
    }
  });
  server.listen(Number(process.env.PORT ?? 4183), "127.0.0.1", () =>
    console.log("Local delivery fixture ready"),
  );
  process.on("SIGINT", () => server.close());
  process.on("SIGTERM", () => server.close());
}
void main();
