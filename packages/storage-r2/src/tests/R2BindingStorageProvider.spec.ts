import type { StorageBody } from "@croco/storage-core";
import { describe, expect, it, vi } from "vitest";
import { createStorageProviderConformanceSuite } from "@croco/testing";
import {
  InMemoryStorageProvider,
  InvalidKeyProblem,
  StorageOperationAbortedProblem,
} from "@croco/storage-core";
import {
  R2BindingProblem,
  R2BindingStorageProvider,
  R2BindingUnsupportedProblem,
} from "../workers";
import type { R2BucketBinding, R2BindingObjectBody } from "../workers";

function fixture() {
  const memory = new InMemoryStorageProvider();
  const bucket: R2BucketBinding = {
    async put(key, body, options) {
      await memory.put(key, body as StorageBody, {
        contentType: options?.httpMetadata?.contentType,
        metadata: options?.customMetadata,
      });
    },
    async head(key) {
      if (!(await memory.exists(key))) return null;
      const m = await memory.getMetadata(key);
      return {
        size: m.size,
        uploaded: m.lastModified,
        httpEtag: '"opaque-etag"',
        httpMetadata: { contentType: m.contentType },
        customMetadata: m.metadata,
      };
    },
    async get(key) {
      const object = await this.head(key);
      return object ? { ...object, body: await memory.getStream(key) } : null;
    },
    delete: (key) => memory.delete(key),
  };
  return bucket;
}

describe("R2 binding storage contract", () => {
  const suite = createStorageProviderConformanceSuite({
    providerName: "r2-binding",
    createProvider: () =>
      new R2BindingStorageProvider(fixture(), { publicUrlBase: "https://objects.fixture" }),
    metadata: { contentType: "required", customMetadata: "required" },
  });
  // The binding cannot sign URLs. Exercise every shared data/validation/cancellation case;
  // the signed-URL success case is replaced by the explicit rejection assertion below.
  it.each(
    suite.cases.filter(
      ({ name }) => name !== "creates public and signed URLs without leaking object contents",
    ),
  )("$name", async ({ run }) => {
    await run();
  });

  it("rejects signed URLs and per-object ACLs without exposing or calling a credential API", async () => {
    const bucket = fixture();
    const put = vi.spyOn(bucket, "put");
    const provider = new R2BindingStorageProvider(bucket);
    await expect(provider.getSignedUrl("tenant-a/file", { expiresIn: 60 })).rejects.toBeInstanceOf(
      R2BindingUnsupportedProblem,
    );
    for (const isPublic of [true, false]) {
      await expect(
        provider.put("tenant-a/file", new Uint8Array([1]), { isPublic }),
      ).rejects.toMatchObject({ code: "STORAGE_R2_BINDING_UNSUPPORTED" });
    }
    expect(put).not.toHaveBeenCalled();
    expect(() => provider.getPublicUrl("tenant-a/file")).toThrow(R2BindingUnsupportedProblem);
  });

  it("encodes public keys and keeps separate server-selected tenant namespaces", async () => {
    const provider = new R2BindingStorageProvider(fixture(), {
      publicUrlBase: "https://objects.fixture/assets/",
    });
    await provider.put("tenant-a/a ?#한글", new Uint8Array([31, 7]));
    await provider.put("tenant-b/a ?#한글", new Uint8Array([9, 63, 5]));
    expect(await provider.get("tenant-a/a ?#한글")).toEqual(new Uint8Array([31, 7]));
    expect(await provider.get("tenant-b/a ?#한글")).toEqual(new Uint8Array([9, 63, 5]));
    expect(provider.getPublicUrl("tenant-a/a ?#한글")).toBe(
      "https://objects.fixture/assets/tenant-a/a%20%3F%23%ED%95%9C%EA%B8%80",
    );
    expect(() => provider.getPublicUrl("a\\b")).toThrow(InvalidKeyProblem);
  });

  it.each([
    "not a URL",
    "data:text/plain,hello",
    "https://user:secret@objects.fixture",
    "https://objects.fixture/?token=secret",
    "https://objects.fixture/#fragment",
  ])("rejects unsafe public base %s", (publicUrlBase) => {
    expect(() => new R2BindingStorageProvider(fixture(), { publicUrlBase })).toThrow(
      InvalidKeyProblem,
    );
  });

  it("preserves binding failure evidence without serializing upstream secrets or retrying", async () => {
    const bucket = fixture();
    const failure = new Error("credential=fixture-secret");
    const get = vi.spyOn(bucket, "get").mockRejectedValue(failure);
    const provider = new R2BindingStorageProvider(bucket);
    let observed: unknown;
    try {
      await provider.get("tenant-a/file");
    } catch (error) {
      observed = error;
    }
    expect(observed).toBeInstanceOf(R2BindingProblem);
    expect(observed).toMatchObject({ code: "STORAGE_R2_BINDING_FAILED", cause: failure });
    expect(JSON.stringify(observed)).not.toContain("fixture-secret");
    expect(get).toHaveBeenCalledTimes(1);
  });

  it("accepts the exact 10MiB buffered boundary and retains the final byte", async () => {
    const provider = new R2BindingStorageProvider(fixture());
    const bytes = new Uint8Array(10 * 1024 * 1024);
    bytes[0] = 37;
    bytes[bytes.length - 1] = 211;
    await provider.put("tenant-a/limit", bytes);
    const result = await provider.get("tenant-a/limit");
    expect(result.byteLength).toBe(10 * 1024 * 1024);
    expect(result[0]).toBe(37);
    expect(result[result.length - 1]).toBe(211);
  });

  it("does not translate a binding outage into a missing object", async () => {
    const bucket = fixture();
    vi.spyOn(bucket, "head").mockRejectedValue(new Error("binding unavailable"));
    const provider = new R2BindingStorageProvider(bucket);
    await expect(provider.exists("file")).rejects.toBeInstanceOf(R2BindingProblem);
    await expect(provider.getMetadata("file")).rejects.toBeInstanceOf(R2BindingProblem);
  });

  it("rejects cancellation promptly and disposes a late read body once", async () => {
    const bucket = fixture();
    let complete: (value: R2BindingObjectBody | null) => void = () => {};
    vi.spyOn(bucket, "get").mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const provider = new R2BindingStorageProvider(bucket);
    const controller = new AbortController();
    const pending = provider.getStream("file", { signal: controller.signal });
    const reason = new Error("stop");
    controller.abort(reason);
    await expect(pending).rejects.toMatchObject({
      code: "STORAGE_OPERATION_ABORTED",
      cause: reason,
    });
    const cancel = vi.fn().mockRejectedValue(new Error("late cancel failed"));
    complete({
      size: 1,
      uploaded: new Date(),
      httpEtag: "opaque",
      body: new ReadableStream({ cancel }),
    });
    await vi.waitFor(() => expect(cancel).toHaveBeenCalledTimes(1));
  });

  it("observes a late rejected operation after cancellation without replaying a mutation", async () => {
    const bucket = fixture();
    let fail: (reason: unknown) => void = () => {};
    const put = vi.spyOn(bucket, "put").mockImplementation(
      () =>
        new Promise((_resolve, reject) => {
          fail = reject;
        }),
    );
    const controller = new AbortController();
    const provider = new R2BindingStorageProvider(bucket);
    const pending = provider.put("file", new Uint8Array([13]), { signal: controller.signal });
    controller.abort();
    await expect(pending).rejects.toBeInstanceOf(StorageOperationAbortedProblem);
    fail(new Error("late write rejection"));
    await Promise.resolve();
    expect(put).toHaveBeenCalledTimes(1);
  });

  it.each([
    { offset: -1 },
    { suffix: 0 },
    { length: 0 },
    { offset: NaN },
    { suffix: 2, offset: 0 },
    {},
  ])("rejects malformed range %j before I/O", async (range) => {
    const bucket = fixture();
    const get = vi.spyOn(bucket, "get");
    const provider = new R2BindingStorageProvider(bucket);
    await expect(
      provider.get("file", { range: range as { offset: number } }),
    ).rejects.toBeInstanceOf(InvalidKeyProblem);
    expect(get).not.toHaveBeenCalled();
  });
});
