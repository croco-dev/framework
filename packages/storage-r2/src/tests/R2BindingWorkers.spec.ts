import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { build } from "esbuild";
import { Miniflare } from "miniflare";

let worker: Miniflare;
beforeAll(async () => {
  const bundle = await build({
    entryPoints: [resolve(import.meta.dirname, "fixtures/r2Worker.ts")],
    bundle: true,
    write: false,
    platform: "browser",
    format: "esm",
    external: ["node:*"],
    alias: {
      "@croco/storage-core": resolve(import.meta.dirname, "../../../storage-core/src/index.ts"),
      "@croco/problems-core": resolve(import.meta.dirname, "../../../problems-core/src/index.ts"),
    },
  });
  const output = bundle.outputFiles[0];
  if (!output) throw new Error("Worker bundle missing");
  worker = new Miniflare({
    modules: true,
    script: output.text,
    compatibilityDate: "2026-03-12",
    r2Buckets: ["BUCKET"],
    compatibilityFlags: ["nodejs_compat"],
  });
});
afterAll(async () => {
  await worker?.dispose();
});

function call(action: string, key = "tenant-a/file", extra: Record<string, string> = {}) {
  return worker.dispatchFetch(
    `https://app.fixture/?${new URLSearchParams({ action, key, ...extra })}`,
  );
}

describe("R2 binding in workerd with native Node compatibility", () => {
  it("stores native streams, reads ranges and metadata, and deletes idempotently", async () => {
    expect((await call("put")).status).toBe(204);
    expect(await (await call("read")).text()).toBe("asymmetric stream payload");
    expect(await (await call("metadata")).json()).toMatchObject({
      size: 25,
      contentType: "text/plain",
      metadata: { owner: "tenant-a" },
    });
    const bucket = await worker.getR2Bucket("BUCKET");
    const object = await bucket.head("tenant-a/file");
    expect(object?.httpMetadata?.cacheControl).toBe("max-age=123");
    expect(await (await call("metadata")).json()).toMatchObject({ etag: object?.httpEtag });
    expect(
      await (await call("range", "tenant-a/file", { range: '{"offset":3,"length":7}' })).text(),
    ).toBe("mmetric");
    expect(await (await call("range", "tenant-a/file", { range: '{"suffix":7}' })).text()).toBe(
      "payload",
    );
    expect(await (await call("range", "tenant-a/file", { range: '{"offset":18}' })).text()).toBe(
      "payload",
    );
    expect(await (await call("exists", "tenant-b/file")).json()).toBe(false);
    expect((await call("delete")).status).toBe(204);
    expect((await call("delete")).status).toBe(204);
    expect(await (await call("exists")).json()).toBe(false);
    for (const action of ["read", "metadata"]) {
      expect(await (await call(action)).json()).toEqual({ code: "STORAGE_FILE_NOT_FOUND" });
    }
  });

  it("streams large objects while rejecting oversized buffered reads", async () => {
    expect(await (await call("large", "tenant-a/large")).json()).toEqual({
      code: "STORAGE_R2_OBJECT_TOO_LARGE",
      size: 10 * 1024 * 1024 + 1,
      first: 17,
      last: 239,
    });
  });

  it("keeps unknown-length upload streams unsupported without buffering or retrying", async () => {
    expect(await (await call("unknown-length", "tenant-a/unknown")).json()).toEqual({
      code: "STORAGE_R2_BINDING_FAILED",
    });
    expect(await (await call("exists", "tenant-a/unknown")).json()).toBe(false);
  });

  it("rejects signing, invalid keys and aborted streams in the Worker", async () => {
    expect(await (await call("signed")).json()).toEqual({ code: "STORAGE_R2_BINDING_UNSUPPORTED" });
    expect(await (await call("put", "tenant-a/../file")).json()).toEqual({
      code: "STORAGE_INVALID_KEY",
    });
    await call("put", "tenant-a/abort");
    expect(await (await call("abort", "tenant-a/abort")).json()).toEqual({
      code: "STORAGE_OPERATION_ABORTED",
    });
  });
});
