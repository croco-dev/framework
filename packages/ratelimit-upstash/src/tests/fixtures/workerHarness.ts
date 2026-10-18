import { resolve } from "node:path";
import { build } from "esbuild";
import { Miniflare, Response } from "miniflare";

export async function createWorker(
  execute: (command: string[]) => Promise<unknown>,
  failureStatus?: number,
): Promise<Miniflare> {
  const bundle = await build({
    entryPoints: [resolve(import.meta.dirname, "upstashWorker.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    alias: {
      "@croco/ratelimit-core": resolve(
        import.meta.dirname,
        "../../../../ratelimit-core/src/index.ts",
      ),
      "@croco/problems-core": resolve(
        import.meta.dirname,
        "../../../../problems-core/src/index.ts",
      ),
    },
  });
  const output = bundle.outputFiles[0];
  if (!output) throw new Error("Worker bundle missing");
  return new Miniflare({
    modules: true,
    script: output.text,
    compatibilityDate: "2026-03-12",
    bindings: {
      UPSTASH_REDIS_REST_URL: "https://redis.fixture",
      UPSTASH_REDIS_REST_TOKEN: "fixture-secret-token",
    },
    outboundService: async (request) => {
      if (new URL(request.url).origin !== "https://redis.fixture")
        throw new Error("Unexpected upstream");
      if (request.headers.get("authorization") !== "Bearer fixture-secret-token") {
        return new Response("unauthorized", { status: 401 });
      }
      if (failureStatus)
        return Response.json(
          { error: "token=fixture-secret-token request rejected" },
          { status: failureStatus, headers: { Location: "https://other.fixture/" } },
        );
      const command = (await request.json()) as string[];
      try {
        return Response.json({ result: await execute(command) });
      } catch (error) {
        return Response.json({ error: String(error) }, { status: 400 });
      }
    },
  });
}
