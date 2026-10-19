import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";
import { XMLParser, XMLValidator } from "fast-xml-parser";
import { InMemoryStorageProvider } from "@croco/storage-core";
import { generateSitemap } from "../libs/sitemap/generateSitemap";
import { FileSitemapPublisher } from "../libs/sitemap/FileSitemapPublisher";
import { createSitemapHandler } from "../libs/sitemap/createSitemapHandler";
import type { SitemapEntry, SitemapPolicy, SitemapSource } from "../libs/sitemap/types";

const policy: SitemapPolicy = {
  tenantId: "shop",
  origin: "https://shop.example",
  approveUrl: (url) => url.pathname.startsWith("/products/"),
  queryValues: { edition: ["blue", "red&gold"] },
};
const entry = (id: string, extra: Partial<SitemapEntry> = {}): SitemapEntry => ({
  resourceId: id,
  tenantId: "shop",
  url: `https://shop.example/products/${id}`,
  canonical: `https://shop.example/products/${id}`,
  publication: "public",
  indexable: true,
  ...extra,
});
function source(entries: readonly SitemapEntry[], revision = "catalog-v7"): SitemapSource {
  return {
    open: async () => ({ revision, tenantId: "shop" }),
    read: async ({ cursor, limit }) => {
      const start = Number(cursor ?? 0);
      const end = Math.min(start + limit, entries.length);
      return {
        revision,
        entries: entries.slice(start, end),
        nextCursor: end < entries.length ? String(end) : null,
        complete: end === entries.length,
      };
    },
  };
}
const parser = new XMLParser({ ignoreAttributes: false });
const directories: string[] = [];
async function directory(): Promise<string> {
  const path = await mkdtemp(join(tmpdir(), "croco-sitemap-"));
  directories.push(path);
  return path;
}
afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((path) => rm(path, { recursive: true, force: true })),
  );
});

describe("Sitemap", () => {
  it("includes only explicit public canonical tenant URLs and reports each exclusion without leaking URLs", async () => {
    const rows = [
      entry("valid", { contentModifiedAt: "2024-02-29" }),
      entry("unknown-date"),
      ...(["private", "draft", "deleted", "redirect", "unknown"] as const).map((publication) =>
        entry(publication, { publication }),
      ),
      entry("not-indexable", { indexable: false }),
      entry("unknown-index", { indexable: null }),
      entry("other-tenant", { tenantId: "other" }),
      entry("alias", { canonical: "https://shop.example/products/valid" }),
      entry("missing-canonical", { canonical: null }),
      entry("valid", { contentModifiedAt: "2024-02-29" }),
      entry("collision-a", {
        url: "https://shop.example/products/collision",
        canonical: "https://shop.example/products/collision",
      }),
      entry("collision-b", {
        url: "https://shop.example/products/collision",
        canonical: "https://shop.example/products/collision",
      }),
    ];
    const generated = await generateSitemap(source(rows), policy);
    expect(generated.report).toMatchObject({
      scanned: 15,
      included: 2,
      lastmodUnknown: 1,
      excluded: {
        publication: 5,
        indexability: 2,
        tenant: 1,
        canonical: 2,
        duplicate: 1,
        "canonical-conflict": 2,
      },
    });
    expect(generated.files[0]?.xml).toContain("<lastmod>2024-02-29</lastmod>");
    expect(generated.files[0]?.xml).not.toContain("private");
    expect(JSON.stringify(generated.report)).not.toContain("https://");
    expect(generated.report.exclusions).toContainEqual({
      resourceId: "private",
      reason: "publication",
      publication: "private",
      count: 1,
    });
    expect(generated.report.exclusions).toContainEqual({
      resourceId: "alias",
      reason: "canonical",
      count: 1,
    });
    expect(JSON.stringify(generated.report)).not.toContain("other-tenant");
  });

  it("bounds deterministic resource-level diagnostics and masks unsafe and other-tenant identifiers", async () => {
    const rows = Array.from({ length: 105 }, (_, i) =>
      entry(`private-${String(i).padStart(3, "0")}`, { publication: "private" }),
    );
    const repeated = rows[0];
    if (!repeated) throw new Error("missing fixture");
    rows.push(repeated);
    const generated = await generateSitemap(source(rows), policy);
    expect(generated.report).toMatchObject({
      scanned: 106,
      included: 0,
      exclusionDetailsTruncated: true,
      excluded: { publication: 106 },
    });
    expect(generated.report.exclusions).toHaveLength(100);
    expect(generated.report.exclusions[0]).toEqual({
      resourceId: "private-000",
      reason: "publication",
      publication: "private",
      count: 2,
    });
    expect(await generateSitemap(source([...rows].reverse()), { ...policy, pageSize: 1 })).toEqual(
      generated,
    );
    const masked = await generateSitemap(
      source([
        entry("person@example.com", { publication: "private" }),
        entry("foreign-secret", { tenantId: "other" }),
      ]),
      policy,
    );
    expect(masked.report.exclusions).toContainEqual({
      resourceId: "[unavailable]",
      reason: "tenant",
      count: 1,
    });
    expect(
      masked.report.exclusions.some(
        (detail) => detail.resourceId.startsWith("sha256:") && detail.reason === "publication",
      ),
    ).toBe(true);
    expect(JSON.stringify(masked.report)).not.toContain("person@example.com");
    expect(JSON.stringify(masked.report)).not.toContain("foreign-secret");
  });

  it("rejects outside origins, credentials, sensitive or unknown queries and XML injection while preserving approved query semantics", async () => {
    const urls = [
      "https://evil.example/products/a",
      "https://user:secret@shop.example/products/a",
      "https://shop.example/products/a?email=person@example.com",
      "https://shop.example/products/a?token=abc",
      "https://shop.example/products/a?edition=secret",
      "https://shop.example/products/a?edition=blue&edition=blue",
      "https://shop.example/private/a",
      "https://shop.example/products/person%40example.com",
      "https://shop.example/products/a#secret",
      "https://shop.example/products/a\n</loc><evil>",
      "https://shop.example/products/a?edition=red%26gold",
    ];
    const generated = await generateSitemap(
      source(urls.map((url, i) => entry(String(i), { url, canonical: url }))),
      policy,
    );
    expect(generated.report.included).toBe(1);
    expect(generated.report.excluded.url).toBe(10);
    const xml = generated.files[0]?.xml ?? "";
    expect(XMLValidator.validate(xml)).toBe(true);
    expect(parser.parse(xml).urlset.url.loc).toBe(
      "https://shop.example/products/a?edition=red%26gold",
    );
  });

  it("sorts before partitioning, round-trips escaped XML and emits only real locale alternates", async () => {
    const rows = [
      entry("z", { locale: "ko", localeGroup: "product-7" }),
      entry("a&b", { locale: "en", localeGroup: "product-7", contentModifiedAt: "not-a-date" }),
      entry("draft", { locale: "fr", localeGroup: "product-7", publication: "draft" }),
    ];
    const one = await generateSitemap(source(rows), { ...policy, pageSize: 1, maxUrlsPerFile: 1 });
    const three = await generateSitemap(source([...rows].reverse()), {
      ...policy,
      pageSize: 3,
      maxUrlsPerFile: 1,
    });
    expect(one).toEqual(three);
    expect(one.report.files.map((file) => file.urls)).toEqual([1, 1]);
    expect(one.files[0]?.xml).toContain("a&amp;b");
    for (const file of one.files) {
      expect(XMLValidator.validate(file.xml)).toBe(true);
      const parsed = parser.parse(file.xml).urlset.url;
      expect(
        parsed["xhtml:link"].map((link: Record<string, string>) => link["@_hreflang"]),
      ).toEqual(["en", "ko"]);
      expect(parsed.lastmod).toBeUndefined();
    }
    expect(XMLValidator.validate(one.index)).toBe(true);
    expect(
      parser.parse(one.index).sitemapindex.sitemap.map((item: { loc: string }) => item.loc),
    ).toEqual([
      `https://shop.example/sitemap-${one.id}-00001.xml`,
      `https://shop.example/sitemap-${one.id}-00002.xml`,
    ]);
  });

  it("splits at the 50000 URL boundary and at an exact UTF-8 byte boundary", async () => {
    const many = await generateSitemap(
      source(Array.from({ length: 50001 }, (_, i) => entry(String(i)))),
      policy,
    );
    expect(many.report.files.map((file) => file.urls)).toEqual([50000, 1]);
    expect(
      many.files.map((file) => {
        const urls = parser.parse(file.xml).urlset.url;
        return Array.isArray(urls) ? urls.length : 1;
      }),
    ).toEqual([50000, 1]);
    const a = entry("é&one");
    const single = await generateSitemap(source([a]), policy);
    const exact = single.report.files[0]?.bytes ?? 0;
    const paired = await generateSitemap(source([a, entry("z&two")]), {
      ...policy,
      maxBytesPerFile: exact,
    });
    expect(paired.report.files.map((file) => file.urls)).toEqual([1, 1]);
    expect(paired.report.files.every((file) => file.bytes <= exact)).toBe(true);
    expect(paired.files.every((file) => Buffer.byteLength(file.xml, "utf8") <= exact)).toBe(true);
    await expect(
      generateSitemap(source([a]), { ...policy, maxBytesPerFile: exact - 1 }),
    ).rejects.toMatchObject({ reason: "limit" });
    await expect(
      generateSitemap(source([]), { ...policy, maxBytesPerFile: 52428801 }),
    ).rejects.toMatchObject({ reason: "invalid-policy" });
    await expect(
      generateSitemap(source([]), { ...policy, maxUrlsPerFile: 50001 }),
    ).rejects.toMatchObject({ reason: "invalid-policy" });
  });

  it("rejects protocol URL length 2048 while retaining 2047", async () => {
    const prefix = "https://shop.example/products/";
    const short = prefix + "a".repeat(2047 - prefix.length);
    const long = prefix + "b".repeat(2048 - prefix.length);
    const generated = await generateSitemap(
      source([
        entry("short", { url: short, canonical: short }),
        entry("long", { url: long, canonical: long }),
      ]),
      policy,
    );
    expect(generated.report.included).toBe(1);
    expect(generated.report.excluded.url).toBe(1);
    expect(parser.parse(generated.files[0]?.xml ?? "").urlset.url.loc).toBe(short);
  });

  it("excludes conflicting canonical identity while retaining distinct real locales", async () => {
    const rows = [
      entry("same", {
        url: "https://shop.example/products/old",
        canonical: "https://shop.example/products/old",
      }),
      entry("same", {
        url: "https://shop.example/products/new",
        canonical: "https://shop.example/products/new",
      }),
      entry("translated", {
        url: "https://shop.example/products/en",
        canonical: "https://shop.example/products/en",
        locale: "en-US",
        localeGroup: "translation",
      }),
      entry("translated", {
        url: "https://shop.example/products/ko",
        canonical: "https://shop.example/products/ko",
        locale: "ko-KR",
        localeGroup: "translation",
      }),
    ];
    const generated = await generateSitemap(source(rows), policy);
    expect(generated.report.included).toBe(2);
    expect(generated.report.excluded["canonical-conflict"]).toBe(2);
    expect(generated.files[0]?.xml).not.toContain("/products/old");
    expect(generated.files[0]?.xml).not.toContain("/products/new");
    expect(
      parser.parse(generated.files[0]?.xml ?? "").urlset.url.map((row: { loc: string }) => row.loc),
    ).toEqual(["https://shop.example/products/en", "https://shop.example/products/ko"]);
  });

  it("omits out-of-range local clocks without dropping public URLs or changing valid timestamps", async () => {
    const generated = await generateSitemap(
      source([
        entry("rollover-z", { contentModifiedAt: "2025-01-01T24:00:00Z" }),
        entry("rollover-offset", { contentModifiedAt: "2025-01-01T24:00:00+09:00" }),
        entry("last-second", { contentModifiedAt: "2025-01-01T23:59:59Z" }),
        entry("start-offset", { contentModifiedAt: "2025-01-01T00:00:00+09:00" }),
      ]),
      policy,
    );
    expect(generated.report).toMatchObject({ included: 4, lastmodUnknown: 2 });
    const urls = parser.parse(generated.files[0]?.xml ?? "").urlset.url;
    expect(
      Object.fromEntries(
        urls.map((url: { loc: string; lastmod?: string }) => [url.loc, url.lastmod ?? null]),
      ),
    ).toEqual({
      "https://shop.example/products/rollover-z": null,
      "https://shop.example/products/rollover-offset": null,
      "https://shop.example/products/last-second": "2025-01-01T23:59:59Z",
      "https://shop.example/products/start-offset": "2025-01-01T00:00:00+09:00",
    });
  });

  it("does not substitute rebuild time for content time and distinguishes complete empty from incomplete sources", async () => {
    const rows = [entry("stable", { contentModifiedAt: "2023-06-08T07:21:04Z" }), entry("unknown")];
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      const first = await generateSitemap(source(rows), policy);
      vi.setSystemTime(new Date("2026-07-30T19:42:00Z"));
      expect(await generateSitemap(source(rows), policy)).toEqual(first);
    } finally {
      vi.useRealTimers();
    }
    expect((await generateSitemap(source([]), policy)).report).toMatchObject({
      sourceComplete: true,
      included: 0,
    });
    const incomplete: SitemapSource = {
      open: async () => ({ revision: "catalog-v7", tenantId: "shop" }),
      read: async () => ({
        revision: "catalog-v7",
        entries: [],
        nextCursor: null,
        complete: false,
      }),
    };
    await expect(generateSitemap(incomplete, policy)).rejects.toMatchObject({
      reason: "source-incomplete",
      report: { sourceComplete: false },
    });
    const changed = {
      ...source([]),
      read: async () => ({ revision: "new", entries: [], nextCursor: null, complete: true }),
    };
    await expect(generateSitemap(changed, policy)).rejects.toMatchObject({
      reason: "source-incomplete",
    });
    const looping = {
      ...source([]),
      read: async () => ({
        revision: "catalog-v7",
        entries: [],
        nextCursor: "same",
        complete: false,
      }),
    };
    await expect(generateSitemap(looping, policy)).rejects.toMatchObject({
      reason: "source-incomplete",
    });
    await expect(generateSitemap(source(rows), { ...policy, maxEntries: 1 })).rejects.toMatchObject(
      { reason: "limit" },
    );
  });

  it("rejects malformed source frames instead of publishing empty or partial success", async () => {
    const frames: readonly unknown[] = [
      "upstream failed",
      [entry("good"), "upstream failed"],
      [{ ...entry("missing-decision"), indexable: undefined }],
    ];
    for (const entries of frames) {
      const malformed: SitemapSource = {
        ...source([]),
        read: async () => ({
          revision: "catalog-v7",
          entries: entries as readonly SitemapEntry[],
          nextCursor: null,
          complete: true,
        }),
      };
      await expect(generateSitemap(malformed, policy)).rejects.toMatchObject({
        reason: "source-incomplete",
        report: { sourceComplete: false },
      });
    }
  });

  it("splits actual uncompressed XML above 50 MiB even below the URL-count limit", async () => {
    const generated = await generateSitemap(
      source(
        Array.from({ length: 26500 }, (_, i) =>
          entry(`${String(i).padStart(5, "0")}-${"x".repeat(1970)}`),
        ),
      ),
      policy,
    );
    expect(generated.report.files).toHaveLength(2);
    expect(generated.report.files.reduce((total, file) => total + file.urls, 0)).toBe(26500);
    expect(
      generated.report.files.every((file) => file.bytes <= 52428800 && file.urls < 50000),
    ).toBe(true);
    expect(generated.report.files.reduce((total, file) => total + file.bytes, 0)).toBeGreaterThan(
      52428800,
    );
    expect(generated.files).toHaveLength(2);
    const actualSizes = generated.files.map((file) => Buffer.byteLength(file.xml, "utf8"));
    expect(actualSizes.every((bytes) => bytes <= 52428800)).toBe(true);
    expect(actualSizes.reduce((sum, bytes) => sum + bytes, 0)).toBeGreaterThan(52428800);
    for (const file of generated.files) expect(XMLValidator.validate(file.xml)).toBe(true);
  });

  it("fails closed on approval errors, too-small empty documents, wrong snapshot tenant and mid-scan outages", async () => {
    await expect(
      generateSitemap(source([entry("valid")]), {
        ...policy,
        approveUrl: () => {
          throw new Error("mapping failed");
        },
      }),
    ).rejects.toMatchObject({ reason: "invalid-policy" });
    await expect(
      generateSitemap(source([]), { ...policy, maxBytesPerFile: 1 }),
    ).rejects.toMatchObject({ reason: "limit" });
    await expect(
      generateSitemap(
        { ...source([]), open: async () => ({ tenantId: "other", revision: "v1" }) },
        policy,
      ),
    ).rejects.toMatchObject({ reason: "source-incomplete", report: { revision: "" } });
    const outage: SitemapSource = {
      ...source([]),
      read: async ({ cursor }) => {
        if (cursor) throw new Error("upstream outage with private connection details");
        return {
          revision: "catalog-v7",
          entries: [entry("partial")],
          nextCursor: "next",
          complete: false,
        };
      },
    };
    await expect(generateSitemap(outage, policy)).rejects.toMatchObject({
      reason: "source-incomplete",
      report: { scanned: 1, sourceComplete: false },
    });
  });

  it("does not rewrite a completed generation and keeps it readable if the next put would corrupt it", async () => {
    const storage = new InMemoryStorageProvider();
    let failWrites = false;
    const publisher = new FileSitemapPublisher(await directory(), {
      get: storage.get.bind(storage),
      put: async (key, value, options) => {
        if (failWrites) {
          await storage.put(key, new Uint8Array([0]));
          throw new Error("partial provider write");
        }
        await storage.put(key, value, options);
      },
    });
    const generated = await generateSitemap(source([entry("preserved")]), policy);
    await publisher.publish(generated, {
      actorId: "operator",
      idempotencyKey: "first",
      expectedGenerationId: null,
    });
    failWrites = true;
    await publisher.publish(generated, {
      actorId: "operator",
      idempotencyKey: "second",
      expectedGenerationId: generated.id,
    });
    expect(await publisher.read(generated.id, "sitemap-00001.xml")).toContain(
      "/products/preserved",
    );
  });

  it("preserves the last complete index on partial storage writes, stale publication and lock contention", async () => {
    const root = await directory();
    const storage = new InMemoryStorageProvider();
    let failing: string | undefined;
    const publisher = new FileSitemapPublisher(root, {
      get: storage.get.bind(storage),
      put: async (key, bytes, options) => {
        if (failing && key.endsWith(failing)) {
          await storage.put(key, new TextEncoder().encode("<partial>"), options);
          throw new Error("injected partial write");
        }
        await storage.put(key, bytes, options);
      },
    });
    const first = await generateSitemap(source([entry("first")]), policy);
    const original = await publisher.publish(first, {
      actorId: "operator",
      idempotencyKey: "one",
      expectedGenerationId: null,
    });
    failing = "sitemap-00002.xml";
    const next = await generateSitemap(source([entry("second"), entry("third")], "v8"), {
      ...policy,
      maxUrlsPerFile: 1,
    });
    await expect(
      publisher.publish(next, {
        actorId: "operator",
        idempotencyKey: "two",
        expectedGenerationId: first.id,
      }),
    ).rejects.toMatchObject({ reason: "storage" });
    expect(await publisher.current()).toEqual(original);
    expect(await publisher.read(next.id, "sitemap-00001.xml")).toBeNull();
    failing = "index.xml";
    await expect(
      publisher.publish(next, {
        actorId: "operator",
        idempotencyKey: "two",
        expectedGenerationId: first.id,
      }),
    ).rejects.toMatchObject({ reason: "storage" });
    expect(await publisher.current()).toEqual(original);
    expect(await publisher.read(next.id, "sitemap-00001.xml")).toBeNull();
    failing = undefined;
    await expect(
      publisher.publish(next, {
        actorId: "operator",
        idempotencyKey: "two",
        expectedGenerationId: null,
      }),
    ).rejects.toMatchObject({ reason: "conflict" });
    await mkdir(join(root, "publish.lock"));
    await expect(
      publisher.publish(next, {
        actorId: "operator",
        idempotencyKey: "two",
        expectedGenerationId: first.id,
      }),
    ).rejects.toMatchObject({ reason: "conflict" });
    await rm(join(root, "publish.lock"), { recursive: true });
    const results = await Promise.allSettled([
      publisher.publish(next, {
        actorId: "operator",
        idempotencyKey: "two",
        expectedGenerationId: first.id,
      }),
      new FileSitemapPublisher(root, storage).publish(next, {
        actorId: "other",
        idempotencyKey: "three",
        expectedGenerationId: first.id,
      }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await publisher.current())?.generationId).toBe(next.id);
    expect(await publisher.read(first.id, "sitemap-00001.xml")).toContain("/products/first");
  });

  it("rejects corrupt pointers instead of interpreting them as an empty first publication", async () => {
    const root = await directory();
    const publisher = new FileSitemapPublisher(root);
    await writeFile(join(root, "current.json"), "{}");
    await expect(publisher.current()).rejects.toMatchObject({ reason: "storage" });
    const generated = await generateSitemap(source([entry("valid")]), policy);
    await expect(
      publisher.publish(generated, {
        actorId: "operator",
        idempotencyKey: "fresh",
        expectedGenerationId: null,
      }),
    ).rejects.toMatchObject({ reason: "storage" });
  });

  it("retains valid offset lastmod and omits impossible calendar dates", async () => {
    const generated = await generateSitemap(
      source([
        entry("offset", { contentModifiedAt: "2024-03-01T00:10:00+09:00" }),
        entry("invalid", { contentModifiedAt: "2023-02-29" }),
      ]),
      policy,
    );
    expect(generated.files[0]?.xml).toContain("<lastmod>2024-03-01T00:10:00+09:00</lastmod>");
    expect(generated.report.lastmodUnknown).toBe(1);
  });

  it("rejects cross-tenant and missing action grants and bounds streaming form reads before generation", async () => {
    const publisher = new FileSitemapPublisher(await directory());
    const read = vi.fn(source([]).read);
    const make = (tenantId: string, permissions: readonly ("sitemap:read" | "sitemap:publish")[]) =>
      createSitemapHandler({
        source: { ...source([]), read },
        policy,
        publisher,
        authorize: async () => ({ actorId: "operator", tenantId, permissions }),
      });
    const request = () =>
      new Request("https://shop.example/admin/sitemap", {
        method: "POST",
        headers: { Origin: policy.origin, "Content-Type": "application/x-www-form-urlencoded" },
        body: "action=publish&revision=catalog-v7&idempotencyKey=key",
      });
    expect((await make("other", ["sitemap:read", "sitemap:publish"])(request()))?.status).toBe(403);
    expect((await make("shop", ["sitemap:read"])(request()))?.status).toBe(403);
    expect(read).not.toHaveBeenCalled();
    let canceled = false;
    const body = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024).fill(97));
      },
      cancel() {
        canceled = true;
      },
    });
    const large = new Request("https://shop.example/admin/sitemap", {
      method: "POST",
      headers: { Origin: policy.origin, "Content-Type": "application/x-www-form-urlencoded" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });
    expect((await make("shop", ["sitemap:read", "sitemap:publish"])(large))?.status).toBe(413);
    expect(canceled).toBe(true);
    expect(read).not.toHaveBeenCalled();
  });

  it("serves actual local HTTP XML/robots and enforces server actor, tenant, permission, origin, revision and idempotency", async () => {
    const publisher = new FileSitemapPublisher(await directory());
    const first = await generateSitemap(source([entry("socket")]), policy);
    const command = { actorId: "operator", idempotencyKey: "same", expectedGenerationId: null };
    await publisher.publish(first, command);
    expect(await publisher.publish(first, command)).toMatchObject({ generationId: first.id });
    await expect(
      publisher.publish(first, { ...command, actorId: "different" }),
    ).rejects.toMatchObject({ reason: "conflict" });
    const handler = createSitemapHandler({
      source: source([entry("socket")]),
      policy,
      publisher,
      authorize: async (request) =>
        request.headers.get("authorization") === "operator"
          ? {
              actorId: "operator",
              tenantId: "shop",
              permissions: ["sitemap:read", "sitemap:regenerate", "sitemap:publish"],
            }
          : null,
    });
    const server = createServer(async (req, res) => {
      const response =
        (await handler(new Request(`http://localhost${req.url ?? "/"}`))) ??
        new Response(null, { status: 404 });
      res.writeHead(response.status, Object.fromEntries(response.headers));
      res.end(await response.text());
    });
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("missing socket");
      const base = `http://127.0.0.1:${address.port}`;
      const index = await (await fetch(`${base}/sitemap.xml`)).text();
      expect(XMLValidator.validate(index)).toBe(true);
      const shard = new URL(parser.parse(index).sitemapindex.sitemap.loc);
      const xml = await (await fetch(`${base}${shard.pathname}`)).text();
      expect(parser.parse(xml).urlset.url.loc).toBe("https://shop.example/products/socket");
      expect(await (await fetch(`${base}/robots.txt`)).text()).toContain(
        "Sitemap: https://shop.example/sitemap.xml",
      );
      expect((await fetch(`${base}/admin/sitemap`)).status).toBe(403);
    } finally {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
    }
    const post = (body: Record<string, string>, origin = policy.origin, auth = "operator") =>
      handler(
        new Request("https://shop.example/admin/sitemap", {
          method: "POST",
          headers: {
            origin,
            authorization: auth,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(body),
        }),
      );
    expect(
      (await post({ action: "publish", revision: "wrong", idempotencyKey: "key" }))?.status,
    ).toBe(409);
    expect(
      (
        await post(
          { action: "publish", revision: "catalog-v7", idempotencyKey: "key" },
          "https://evil.example",
        )
      )?.status,
    ).toBe(403);
    expect(
      (
        await post(
          { action: "publish", revision: "catalog-v7", idempotencyKey: "key" },
          policy.origin,
          "anonymous",
        )
      )?.status,
    ).toBe(403);
    expect(
      (
        await post({
          action: "publish",
          revision: "catalog-v7",
          expectedGenerationId: first.id,
          idempotencyKey: "key",
          actorId: "forged-client-actor",
          tenantId: "other",
        })
      )?.status,
    ).toBe(200);
    expect((await publisher.current())?.actorId).toBe("operator");
  });
});
