import { createHmac, createHash } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createStorageProviderConformanceSuite } from "@croco/testing";
import {
  readStorageStream,
  StorageOperationAbortedProblem,
  storageStreamFromBytes,
} from "@croco/storage-core";
import { S3StorageProvider, S3StorageProblem } from "../index";
import { createS3Fixture } from "./s3Fixture";

const credentials = {
  accessKeyId: "fixture-access",
  secretAccessKey: "fixture-secret",
  sessionToken: "fixture-session",
};
let fixture: Awaited<ReturnType<typeof createS3Fixture>>;
const providers: S3StorageProvider[] = [];
function provider(prefix = "tenant-a/") {
  const result = new S3StorageProvider({
    bucket: "fixture-bucket",
    region: "ap-northeast-2",
    credentials,
    endpoint: fixture.endpoint,
    forcePathStyle: true,
    keyPrefix: prefix,
    publicUrlBase: "https://cdn.example.test",
  });
  providers.push(result);
  return result;
}
beforeAll(async () => {
  fixture = await createS3Fixture();
});
afterAll(async () => {
  for (const p of providers) p.destroy();
  await fixture.close();
});

describe("S3StorageProvider HTTP conformance", () => {
  const suite = createStorageProviderConformanceSuite({
    providerName: "storage-s3",
    createProvider: () => provider(),
    metadata: { contentType: "required", customMetadata: "required" },
    publicUrl: /^https:\/\/cdn.example.test\/tenant-a\//,
    signedUrl: (url) => {
      expect(new URL(url).searchParams.get("X-Amz-Signature")).toMatch(/^[a-f0-9]{64}$/);
    },
  });
  it.each(suite.cases)("$name", async ({ run }) => {
    await run();
  });

  it("preserves namespace, metadata, byte range, private ACL and opaque ETag on real SDK requests", async () => {
    const p = provider();
    await p.put("dir/a b+한.txt", new TextEncoder().encode("abcdefghijk"), {
      contentType: "text/plain",
      cacheControl: "max-age=42",
      metadata: { owner: "team-a" },
    });
    expect(await p.get("dir/a b+한.txt", { range: { start: 2, end: 5 } })).toEqual(
      new TextEncoder().encode("cdef"),
    );
    expect(await p.get("dir/a b+한.txt", { range: { start: 8 } })).toEqual(
      new TextEncoder().encode("ijk"),
    );
    expect((await p.getMetadata("dir/a b+한.txt")).etag).toBe('"object-etag"');
    const request = fixture.requests.find(
      (r) => r.method === "PUT" && r.key.endsWith("a b+한.txt"),
    );
    expect(request?.key).toBe("/fixture-bucket/tenant-a/dir/a b+한.txt");
    expect(request?.headers["x-amz-acl"]).toBeUndefined();
    expect(request?.headers["cache-control"]).toBe("max-age=42");
    expect(request?.headers["x-amz-security-token"]).toBe("fixture-session");
    expect(p.getPublicUrl("dir/a b+한.txt")).toBe(
      "https://cdn.example.test/tenant-a/dir/a%20b%2B%ED%95%9C.txt",
    );
    expect(await provider("tenant-b/").exists("dir/a b+한.txt")).toBe(false);
  });

  it("uploads asymmetric multi-part bytes and awaits deletion of incomplete upload on failure", async () => {
    const p = provider();
    const bytes = new Uint8Array(5 * 1024 * 1024 + 713).fill(71);
    bytes.set([21, 78, 36, 99]);
    bytes.set([31, 54, 201, 8, 61, 74, 9, 16], 5 * 1024 * 1024 - 4);
    bytes.set([9, 32, 255], bytes.length - 3);
    const input = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.subarray(0, 17));
        controller.enqueue(bytes.subarray(17, 5 * 1024 * 1024 + 23));
        controller.enqueue(bytes.subarray(5 * 1024 * 1024 + 23));
        controller.close();
      },
    });
    await p.put("large", input, { metadata: { mode: "multipart" } });
    expect(Buffer.from(await p.get("large")).equals(bytes)).toBe(true);
    expect((await p.getMetadata("large")).metadata).toEqual({ mode: "multipart" });
    expect(fixture.uploads.size).toBe(0);
    const parts = fixture.requests.filter(
      (r) => r.method === "PUT" && r.key.endsWith("/large") && r.query.has("partNumber"),
    );
    expect(parts.map((r) => r.query.get("partNumber"))).toEqual(["1", "2"]);
    expect(parts.map((r) => Number(r.headers["content-length"]))).toEqual([5 * 1024 * 1024, 713]);
    fixture.failPart = true;
    try {
      await expect(p.put("failed", storageStreamFromBytes(bytes))).rejects.toBeInstanceOf(
        S3StorageProblem,
      );
    } finally {
      fixture.failPart = false;
    }
    expect(fixture.uploads.size).toBe(0);
    expect(await p.exists("failed")).toBe(false);
  });

  it("cancels a stalled source and awaits multipart abort before returning", async () => {
    const p = provider();
    const controller = new AbortController();
    let cancelled = false;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        c.enqueue(new Uint8Array(5 * 1024 * 1024).fill(83));
      },
      cancel() {
        cancelled = true;
      },
    });
    fixture.onPart = () => {
      controller.abort(new Error("caller stopped"));
    };
    try {
      await expect(
        p.put("cancelled", stream, { signal: controller.signal }),
      ).rejects.toBeInstanceOf(StorageOperationAbortedProblem);
    } finally {
      fixture.onPart = undefined;
    }
    expect(cancelled).toBe(true);
    expect(fixture.uploads.size).toBe(0);
    expect(await p.exists("cancelled")).toBe(false);
  });

  it("cleans multipart state when the source fails after a part was accepted", async () => {
    let source: ReadableStreamDefaultController<Uint8Array> | undefined;
    const stream = new ReadableStream<Uint8Array>({
      start(c) {
        source = c;
        c.enqueue(new Uint8Array(5 * 1024 * 1024).fill(19));
      },
    });
    fixture.onPart = () => source?.error(new Error("source-sensitive-failure"));
    try {
      await expect(provider().put("source-failed", stream)).rejects.toMatchObject({
        code: "STORAGE_S3_FAILED",
        message: "S3 put failed",
      });
    } finally {
      fixture.onPart = undefined;
    }
    expect(fixture.uploads.size).toBe(0);
    expect(await provider().exists("source-failed")).toBe(false);
  });

  it("stores empty streams and cancels a returned download stream with the caller reason", async () => {
    const p = provider();
    await p.put(
      "empty",
      new ReadableStream({
        start(c) {
          c.close();
        },
      }),
    );
    expect((await p.getMetadata("empty")).size).toBe(0);
    expect(await p.get("empty")).toEqual(new Uint8Array());
    await p.put("download-cancel", new Uint8Array(8192).fill(27));
    const controller = new AbortController();
    const stream = await p.getStream("download-cancel", { signal: controller.signal });
    const reason = new Error("download stopped");
    controller.abort(reason);
    await expect(readStorageStream(stream)).rejects.toMatchObject({
      code: "STORAGE_OPERATION_ABORTED",
      cause: reason,
    });
  });

  it("refreshes explicitly supplied expiring session credentials without capturing them in metadata", async () => {
    let version = 0;
    const p = new S3StorageProvider({
      bucket: "fixture-bucket",
      region: "ap-northeast-2",
      endpoint: fixture.endpoint,
      forcePathStyle: true,
      credentials: async () => ({
        accessKeyId: "rotating-access",
        secretAccessKey: "rotating-secret",
        sessionToken: `session-${++version}`,
        expiration: new Date(Date.now() + 1000),
      }),
    });
    providers.push(p);
    await p.put("refresh-one", new Uint8Array([9, 3]));
    await p.put("refresh-two", new Uint8Array([7, 2]));
    const tokens = fixture.requests
      .filter((r) => r.method === "PUT" && r.key.includes("/refresh-"))
      .map((r) => r.headers["x-amz-security-token"]);
    expect(tokens).toHaveLength(2);
    expect(tokens[0]).not.toBe(tokens[1]);
  });

  it.each([false, true])(
    "preserves the prior object when an upload source yields non-bytes (after part: %s)",
    async (afterPart) => {
      const p = provider();
      const original = new Uint8Array([53, 9, 77]);
      await p.put("invalid-source", original);
      const input = new ReadableStream<Uint8Array>({
        start(controller) {
          if (afterPart) controller.enqueue(new Uint8Array(5 * 1024 * 1024).fill(19));
          controller.enqueue("not byte data" as unknown as Uint8Array);
          controller.close();
        },
      });
      await expect(p.put("invalid-source", input)).rejects.toMatchObject({
        code: "STORAGE_S3_FAILED",
      });
      expect(await p.get("invalid-source")).toEqual(original);
      expect(fixture.uploads.size).toBe(0);
    },
  );

  it.each([
    { label: "empty string", body: "" },
    { label: "empty array", body: [] },
  ])("preserves an existing object for an invalid outer body ($label)", async ({ body }) => {
    const p = provider();
    const original = new Uint8Array([53, 9, 77]);
    await p.put("invalid-body", original);
    await expect(
      p.put("invalid-body", body as unknown as ReadableStream<Uint8Array>),
    ).rejects.toMatchObject({ code: "STORAGE_S3_FAILED" });
    expect(await p.get("invalid-body")).toEqual(original);
  });

  it("reports cleanup failure explicitly without exposing upstream messages", async () => {
    fixture.failPart = true;
    fixture.failCleanup = true;
    try {
      await expect(
        provider().put("orphan", storageStreamFromBytes(new Uint8Array([12, 72, 39]))),
      ).rejects.toMatchObject({
        code: "STORAGE_S3_FAILED",
        message: "S3 put failed",
        extensions: { details: { operation: "put", cleanupFailed: true } },
      });
    } finally {
      fixture.failPart = false;
      fixture.failCleanup = false;
      fixture.uploads.clear();
    }
  });

  it("bounds a stalled multipart cleanup independently from the cancelled operation", async () => {
    fixture.failPart = true;
    fixture.stallCleanup = true;
    const p = new S3StorageProvider({
      bucket: "fixture-bucket",
      region: "ap-northeast-2",
      endpoint: fixture.endpoint,
      forcePathStyle: true,
      credentials,
      cleanupTimeoutMs: 100,
    });
    providers.push(p);
    try {
      await expect(
        p.put("stalled-cleanup", storageStreamFromBytes(new Uint8Array([3, 81]))),
      ).rejects.toMatchObject({
        code: "STORAGE_S3_FAILED",
        extensions: { details: { cleanupFailed: true } },
      });
    } finally {
      fixture.failPart = false;
      fixture.stallCleanup = false;
      fixture.uploads.clear();
    }
  });

  it("rejects conditional overwrite and preserves the original object for small and multipart writes", async () => {
    const p = provider();
    const original = new Uint8Array([34, 9, 71]);
    await p.put("conditional", original);
    for (const data of [new Uint8Array([5]), storageStreamFromBytes(new Uint8Array([7, 52]))]) {
      await expect(p.put("conditional", data, { ifNoneMatch: "*" })).rejects.toBeInstanceOf(
        S3StorageProblem,
      );
      expect(await p.get("conditional")).toEqual(original);
      expect(fixture.uploads.size).toBe(0);
    }
    await expect(
      p.put("conditional", new Uint8Array([6]), { ifMatch: '"stale"' }),
    ).rejects.toBeInstanceOf(S3StorageProblem);
  });

  it("keeps AccessDenied distinct from missing and redacts the public Problem", async () => {
    fixture.forbidden = true;
    try {
      await expect(provider().exists("secret")).rejects.toMatchObject({
        code: "STORAGE_S3_FAILED",
        message: "S3 getMetadata failed",
      });
    } finally {
      fixture.forbidden = false;
    }
  });

  it("validates range, key bytes, prefix and public ACL before network I/O", async () => {
    const p = provider();
    const count = fixture.requests.length;
    for (const range of [
      { start: -1 },
      { start: 2, end: 1 },
      { start: 1.5 },
      { start: 0, end: NaN },
    ])
      await expect(p.get("range", { range })).rejects.toBeInstanceOf(S3StorageProblem);
    await expect(p.put("acl", new Uint8Array([1]), { isPublic: true })).rejects.toBeInstanceOf(
      S3StorageProblem,
    );
    await expect(p.get("한".repeat(342))).rejects.toMatchObject({ code: "STORAGE_INVALID_KEY" });
    expect(() => provider("../bad/")).toThrow();
    expect(() => provider("bad")).toThrow();
    expect(fixture.requests.length).toBe(count);
  });

  it("produces independently verifiable SigV4 GET URLs with session credentials", async () => {
    const url = new URL(await provider().getSignedUrl("signed name", { expiresIn: 61 }));
    const q = url.searchParams;
    const date = q.get("X-Amz-Date") ?? "";
    const scope = `${date.slice(0, 8)}/ap-northeast-2/s3/aws4_request`;
    const encode = (s: string) =>
      encodeURIComponent(s).replace(
        /[!'()*]/g,
        (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
      );
    const canonicalQuery = [...q]
      .filter(([k]) => k !== "X-Amz-Signature")
      .map(([k, v]) => [encode(k), encode(v)])
      .sort(([a, av], [b, bv]) => (a === b ? (av < bv ? -1 : 1) : a < b ? -1 : 1))
      .map(([k, v]) => `${k}=${v}`)
      .join("&");
    const hash = (s: string) => createHash("sha256").update(s).digest("hex");
    const request = [
      "GET",
      url.pathname,
      canonicalQuery,
      `host:${url.host}\n`,
      "host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const sign = (key: Buffer | string, s: string) => createHmac("sha256", key).update(s).digest();
    const signing = sign(
      sign(
        sign(sign(`AWS4${credentials.secretAccessKey}`, date.slice(0, 8)), "ap-northeast-2"),
        "s3",
      ),
      "aws4_request",
    );
    expect(q.get("X-Amz-Signature")).toBe(
      sign(signing, `AWS4-HMAC-SHA256\n${date}\n${scope}\n${hash(request)}`).toString("hex"),
    );
    expect(q.get("X-Amz-Expires")).toBe("61");
    expect(q.get("X-Amz-Security-Token")).toBe("fixture-session");
  });
});
