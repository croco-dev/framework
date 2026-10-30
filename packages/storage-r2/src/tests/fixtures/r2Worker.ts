import { R2BindingStorageProvider } from "../../workers";
import type { R2BindingRange } from "../../workers";
import type { R2Bucket } from "@cloudflare/workers-types/experimental";

type Bindings = { BUCKET: R2Bucket };

export default {
  async fetch(request: Request, env: Bindings): Promise<Response> {
    const url = new URL(request.url);
    const provider = new R2BindingStorageProvider(env.BUCKET, {
      publicUrlBase: "https://objects.fixture/",
    });
    const key = url.searchParams.get("key") ?? "tenant-a/file";
    const action = url.searchParams.get("action");
    try {
      if (action === "put") {
        // R2 requires a native known-length stream. Never buffer to disguise that constraint.
        await provider.put(
          key,
          new Response("asymmetric stream payload").body ?? new Uint8Array(),
          {
            contentType: "text/plain",
            cacheControl: "max-age=123",
            metadata: { owner: "tenant-a" },
          },
        );
        return new Response(null, { status: 204 });
      }
      if (action === "unknown-length") {
        await provider.put(
          key,
          new ReadableStream<Uint8Array>({
            start(controller) {
              controller.enqueue(new Uint8Array([7, 29]));
              controller.close();
            },
          }),
        );
        return new Response(null, { status: 204 });
      }
      if (action === "large") {
        const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
        bytes[0] = 17;
        bytes[bytes.length - 1] = 239;
        await provider.put(key, bytes);
        try {
          await provider.get(key);
        } catch (error) {
          const stream = await provider.getStream(key);
          let size = 0;
          let first: number | undefined;
          let last: number | undefined;
          for await (const chunk of stream) {
            if (size === 0) first = chunk[0];
            size += chunk.byteLength;
            last = chunk[chunk.byteLength - 1];
          }
          return Response.json({
            code: error instanceof Error && "code" in error ? error.code : null,
            size,
            first,
            last,
          });
        }
        return new Response("buffer limit missing", { status: 500 });
      }
      if (action === "range") {
        const range = JSON.parse(url.searchParams.get("range") ?? "{}") as R2BindingRange;
        return new Response(new Uint8Array(await provider.get(key, { range })));
      }
      if (action === "metadata") return Response.json(await provider.getMetadata(key));
      if (action === "signed")
        return new Response(await provider.getSignedUrl(key, { expiresIn: 60 }));
      if (action === "delete") {
        await provider.delete(key);
        return new Response(null, { status: 204 });
      }
      if (action === "exists") return Response.json(await provider.exists(key));
      if (action === "abort") {
        const controller = new AbortController();
        const stream = await provider.getStream(key, { signal: controller.signal });
        controller.abort(new Error("fixture abort"));
        await new Response(stream).arrayBuffer();
      }
      return new Response(await provider.getStream(key));
    } catch (error) {
      if (error instanceof Error && "code" in error)
        return Response.json({ code: error.code }, { status: 400 });
      throw error;
    }
  },
};
