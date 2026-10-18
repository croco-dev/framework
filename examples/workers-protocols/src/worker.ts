import { createCloudflareWorkersHost } from "@croco/preset-cloudflare/fetch";
import schemaSDL from "./schema.graphql";
import { createProtocolFixture } from "./application";

const host = createCloudflareWorkersHost(createProtocolFixture(schemaSDL));

export default {
  fetch(request: Request, env: Parameters<typeof host>[1], context: Parameters<typeof host>[2]) {
    if (new URL(request.url).pathname === "/aborted-trpc") {
      const controller = new AbortController();
      controller.abort();
      return host(
        new Request("http://worker/trpc/probe.signal", {
          headers: request.headers,
          signal: controller.signal,
        }),
        env,
        context,
      );
    }
    return host(request, env, context);
  },
};
