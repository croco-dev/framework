import { generateSitemap, escapeSitemapXml } from "./generateSitemap";
import { SitemapProblem } from "./SitemapProblem";
import type { SitemapPolicy, SitemapPublisher, SitemapReport, SitemapSource } from "./types";

export type SitemapAccess = {
  readonly actorId: string;
  readonly tenantId: string;
  readonly permissions: readonly ("sitemap:read" | "sitemap:regenerate" | "sitemap:publish")[];
};

export type SitemapHandlerOptions = {
  readonly source: SitemapSource;
  readonly policy: SitemapPolicy;
  readonly publisher: SitemapPublisher;
  /** Authenticate from server-owned session/authorization data. Never trust request actor fields. */
  readonly authorize: (request: Request) => Promise<SitemapAccess | null>;
};

async function readForm(request: Request): Promise<URLSearchParams> {
  const reader = request.body?.getReader();
  if (!reader) return new URLSearchParams();
  const decoder = new TextDecoder();
  let bytes = 0;
  let text = "";
  try {
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 2048) {
        await reader.cancel();
        throw new SitemapProblem("limit");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    return new URLSearchParams(text + decoder.decode());
  } finally {
    reader.releaseLock();
  }
}

function preview(
  report: SitemapReport | null,
  current: string | null,
  state: "idle" | "preview" | "published" | "incomplete",
  generationId: string | null,
  access: SitemapAccess,
): string {
  return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Sitemap report</title>
  <style>body{font:16px system-ui;margin:2rem auto;padding:0 1rem;max-width:64rem}pre{white-space:pre-wrap;overflow-wrap:anywhere}label{display:block;margin:1rem 0}input{max-width:100%;box-sizing:border-box}button{padding:.6rem 1rem;margin:.5rem .5rem .5rem 0}table{border-collapse:collapse}td,th{padding:.5rem;text-align:left;border-bottom:1px solid #ccc}</style>
  <main><h1>Sitemap report</h1><p>Last successful revision: ${escapeSitemapXml(current ?? "none")}</p>
  <p role="status">${state === "incomplete" ? "Source incomplete. Current publication preserved." : state === "published" ? "Complete sitemap published." : state === "preview" ? "Snapshot complete. Preview does not publish." : "Last published report."}</p>
  ${
    report
      ? `<p>Included: ${report.included}; scanned: ${report.scanned}; lastmod unknown: ${report.lastmodUnknown}</p><h2>Exclusions</h2><table><tr><th>Reason</th><th>Count</th></tr>${Object.entries(
          report.excluded,
        )
          .map(
            ([reason, count]) => `<tr><td>${escapeSitemapXml(reason)}</td><td>${count}</td></tr>`,
          )
          .join(
            "",
          )}</table><h2>Files</h2><table><tr><th>Name</th><th>Bytes</th><th>URLs</th></tr>${report.files.map((file) => `<tr><td>${escapeSitemapXml(file.name)}</td><td>${file.bytes}</td><td>${file.urls}</td></tr>`).join("")}</table>`
      : ""
  }
  <form method="post"><label>Expected source revision <input name="revision" required maxlength="256" value="${escapeSitemapXml(report?.revision ?? current ?? "")}"></label><label>Expected generation ID (empty for first publication) <input name="expectedGenerationId" maxlength="64" value="${escapeSitemapXml(generationId ?? "")}"></label><label>Idempotency key <input name="idempotencyKey" required maxlength="128"></label><button name="action" value="regenerate" ${access.permissions.includes("sitemap:regenerate") ? "" : "disabled"}>Regenerate preview</button><button name="action" value="publish" ${access.permissions.includes("sitemap:publish") ? "" : "disabled"}>Publish complete sitemap</button></form></main></html>`;
}

/** Mount before the application's fallback/page renderer; unrelated paths return null. */
export function createSitemapHandler(
  options: SitemapHandlerOptions,
): (request: Request) => Promise<Response | null> {
  return async (request) => {
    const url = new URL(request.url);
    const admin = url.pathname === "/admin/sitemap";
    const shard = /^\/sitemap-([a-f0-9]{64})-(\d{5}\.xml)$/.exec(url.pathname);
    if (!admin && !shard && !["/sitemap.xml", "/robots.txt"].includes(url.pathname)) return null;
    try {
      if (!admin) {
        if (!["GET", "HEAD"].includes(request.method))
          return new Response(null, { status: 405, headers: { Allow: "GET, HEAD" } });
        const current = await options.publisher.current();
        if (!current)
          return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
        const xml = shard
          ? await options.publisher.read(shard[1] ?? "", `sitemap-${shard[2] ?? ""}`)
          : url.pathname === "/robots.txt"
            ? `User-agent: *\nSitemap: ${new URL("/sitemap.xml", options.policy.origin).href}\n`
            : current.index;
        if (xml === null) return new Response(null, { status: 404 });
        return new Response(request.method === "HEAD" ? null : xml, {
          headers: {
            "Content-Type":
              url.pathname === "/robots.txt"
                ? "text/plain; charset=utf-8"
                : "application/xml; charset=utf-8",
            "Cache-Control": shard ? "public, max-age=31536000, immutable" : "no-cache",
            "X-Content-Type-Options": "nosniff",
          },
        });
      }
      const access = await options.authorize(request);
      if (
        !access?.actorId.trim() ||
        access.tenantId !== options.policy.tenantId ||
        !access.permissions.includes("sitemap:read")
      )
        throw new SitemapProblem("access");
      if (!["GET", "POST"].includes(request.method))
        return new Response(null, { status: 405, headers: { Allow: "GET, POST" } });
      const current = await options.publisher.current();
      let report: SitemapReport | null = current?.report ?? null;
      let published = false;
      let incomplete = false;
      if (request.method === "POST") {
        if (
          request.headers.get("origin") !== new URL(options.policy.origin).origin ||
          request.headers.get("content-type")?.split(";")[0] !== "application/x-www-form-urlencoded"
        )
          throw new SitemapProblem("access");
        const form = await readForm(request);
        const action = form.get("action");
        if (
          (action !== "publish" && action !== "regenerate") ||
          !access.permissions.includes(`sitemap:${action}`)
        )
          throw new SitemapProblem("access");
        const revision = form.get("revision") ?? "";
        const key = form.get("idempotencyKey") ?? "";
        if (!revision.trim() || revision.length > 256 || !key.trim() || key.length > 128)
          throw new SitemapProblem("access");
        try {
          const generated = await generateSitemap(options.source, options.policy);
          if (generated.revision !== revision) throw new SitemapProblem("conflict");
          report = generated.report;
          if (action === "publish") {
            await options.publisher.publish(generated, {
              actorId: access.actorId,
              idempotencyKey: key,
              expectedGenerationId: form.get("expectedGenerationId") || null,
            });
            published = true;
          }
        } catch (error) {
          if (!(error instanceof SitemapProblem) || error.reason !== "source-incomplete")
            throw error;
          report = error.report ?? null;
          incomplete = true;
        }
      }
      const latest = request.method === "POST" ? await options.publisher.current() : current;
      return new Response(
        preview(
          report,
          latest?.revision ?? null,
          incomplete
            ? "incomplete"
            : published
              ? "published"
              : request.method === "POST"
                ? "preview"
                : "idle",
          latest?.generationId ?? null,
          access,
        ),
        {
          status: incomplete ? 503 : 200,
          headers: {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'",
            "X-Content-Type-Options": "nosniff",
          },
        },
      );
    } catch (error) {
      const problem = error instanceof SitemapProblem ? error : new SitemapProblem("storage");
      return Response.json(problem.toJSON(), {
        status: problem.status,
        headers: { "Cache-Control": "no-store" },
      });
    }
  };
}
