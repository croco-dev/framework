import { createHash } from "node:crypto";
import { SitemapProblem } from "./SitemapProblem";
import type {
  SitemapEntry,
  SitemapGeneration,
  SitemapPolicy,
  SitemapReport,
  SitemapSource,
} from "./types";

const HEADER = '<?xml version="1.0" encoding="UTF-8"?>\n';
const OPEN = `${HEADER}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n`;
const CLOSE = "</urlset>\n";
const INDEX_OPEN = `${HEADER}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;
const INDEX_CLOSE = "</sitemapindex>\n";
const encoder = new TextEncoder();

export function escapeSitemapXml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char] ?? char,
  );
}

function bound(value: number | undefined, fallback: number, maximum: number): number {
  const resolved = value ?? fallback;
  if (!Number.isSafeInteger(resolved) || resolved < 1 || resolved > maximum)
    throw new SitemapProblem("invalid-policy");
  return resolved;
}

function originOf(policy: SitemapPolicy): string {
  let url: URL;
  try {
    url = new URL(policy.origin);
  } catch {
    throw new SitemapProblem("invalid-policy");
  }
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.href !== `${url.origin}/` ||
    !policy.tenantId.trim()
  )
    throw new SitemapProblem("invalid-policy");
  return url.origin;
}

function publicUrl(raw: string, origin: string, policy: SitemapPolicy): string | null {
  if (typeof raw !== "string") return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (
    Array.from(raw).some((char) => char.charCodeAt(0) <= 32 || char.charCodeAt(0) === 127) ||
    raw.length > 2048
  )
    return null;
  if (
    url.href.length > 2048 ||
    url.origin !== origin ||
    url.username ||
    url.password ||
    raw.includes("#")
  )
    return null;
  if (/@|%40/i.test(url.pathname)) return null;
  const seen = new Set<string>();
  for (const [key, value] of url.searchParams) {
    const allowed = Object.hasOwn(policy.queryValues ?? {}, key)
      ? policy.queryValues?.[key]
      : undefined;
    if (
      seen.has(key) ||
      /token|secret|password|email|session|credential|authorization|user|customer/i.test(key) ||
      value.includes("@") ||
      Array.from(value).some((char) => char.charCodeAt(0) < 32) ||
      !Array.isArray(allowed) ||
      !allowed.includes(value)
    )
      return null;
    seen.add(key);
  }
  // Give the callback a copy so it cannot rewrite the checked origin or query.
  try {
    return policy.approveUrl(new URL(url.href)) ? url.href : null;
  } catch {
    throw new SitemapProblem("invalid-policy");
  }
}

function lastmod(entry: SitemapEntry): string | undefined {
  const text = entry.contentModifiedAt;
  if (
    typeof text !== "string" ||
    !text ||
    !/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2}))?$/.test(text)
  )
    return undefined;
  const date = new Date(text);
  const day = new Date(text.slice(0, 10));
  if (
    !Number.isFinite(date.getTime()) ||
    !Number.isFinite(day.getTime()) ||
    day.toISOString().slice(0, 10) !== text.slice(0, 10)
  )
    return undefined;
  return text;
}

/** Bounded materialization, then canonical sort; cursor page boundaries never affect XML bytes. */
export async function generateSitemap(
  source: SitemapSource,
  policy: SitemapPolicy,
): Promise<SitemapGeneration> {
  const origin = originOf(policy);
  const pageSize = bound(policy.pageSize, 1000, 50000);
  const maxPages = bound(policy.maxPages, 10000, 1000000);
  const maxEntries = bound(policy.maxEntries, 1000000, 10000000);
  const maxUrls = bound(policy.maxUrlsPerFile, 50000, 50000);
  const maxBytes = bound(policy.maxBytesPerFile, 52428800, 52428800);
  const excluded = {
    publication: 0,
    indexability: 0,
    tenant: 0,
    url: 0,
    canonical: 0,
    duplicate: 0,
    "canonical-conflict": 0,
    locale: 0,
  };
  let revision = "";
  let scanned = 0;
  const report = (complete: boolean): SitemapReport => ({
    revision,
    sourceComplete: complete,
    scanned,
    included: 0,
    excluded: { ...excluded },
    lastmodUnknown: 0,
    files: [],
  });
  const entries: SitemapEntry[] = [];
  try {
    const snapshot = await source.open();
    revision = snapshot.revision;
    if (
      typeof revision !== "string" ||
      !/^[A-Za-z0-9._:-]{1,256}$/.test(revision) ||
      snapshot.tenantId !== policy.tenantId
    )
      throw new SitemapProblem("source-incomplete");
    let cursor: string | null = null;
    const cursors = new Set<string>();
    let complete = false;
    for (let pageNumber = 0; pageNumber < maxPages; pageNumber++) {
      const page = await source.read({ revision, cursor, limit: pageSize });
      if (
        page.revision !== revision ||
        page.entries.length > pageSize ||
        page.complete !== (page.nextCursor === null)
      )
        throw new SitemapProblem("source-incomplete");
      scanned += page.entries.length;
      if (scanned > maxEntries) throw new SitemapProblem("limit");
      entries.push(...page.entries);
      if (page.complete) {
        complete = true;
        break;
      }
      if (!page.nextCursor || cursors.has(page.nextCursor))
        throw new SitemapProblem("source-incomplete");
      cursors.add(page.nextCursor);
      cursor = page.nextCursor;
    }
    if (!complete) throw new SitemapProblem("source-incomplete");
  } catch (error) {
    throw new SitemapProblem(
      error instanceof SitemapProblem ? error.reason : "source-incomplete",
      report(false),
    );
  }

  const candidates = new Map<string, SitemapEntry[]>();
  for (const entry of entries) {
    if (entry.tenantId !== policy.tenantId) {
      excluded.tenant++;
      continue;
    }
    if (entry.publication !== "public") {
      excluded.publication++;
      continue;
    }
    if (entry.indexable !== true) {
      excluded.indexability++;
      continue;
    }
    const url = publicUrl(entry.url, origin, policy);
    if (!url) {
      excluded.url++;
      continue;
    }
    if (
      typeof entry.resourceId !== "string" ||
      !entry.resourceId.trim() ||
      !entry.canonical ||
      publicUrl(entry.canonical, origin, policy) !== url
    ) {
      excluded.canonical++;
      continue;
    }
    if (
      (entry.locale && !/^(?:[a-z]{2,3})(?:-[A-Za-z0-9]{2,8})*$/.test(entry.locale)) ||
      Boolean(entry.locale) !== Boolean(entry.localeGroup)
    ) {
      excluded.locale++;
      continue;
    }
    const group = candidates.get(url) ?? [];
    group.push({ ...entry, url });
    candidates.set(url, group);
  }
  const accepted: SitemapEntry[] = [];
  for (const [, group] of candidates) {
    const first = group[0];
    if (!first) continue;
    const signature = (entry: SitemapEntry) =>
      JSON.stringify([entry.resourceId, lastmod(entry), entry.locale, entry.localeGroup]);
    if (group.some((entry) => signature(entry) !== signature(first))) {
      excluded["canonical-conflict"] += group.length;
      continue;
    }
    excluded.duplicate += group.length - 1;
    accepted.push(first);
  }
  accepted.sort((a, b) => (a.url < b.url ? -1 : a.url > b.url ? 1 : 0));
  const localeGroups = new Map<string, SitemapEntry[]>();
  for (const entry of accepted) {
    if (!entry.localeGroup) continue;
    const group = localeGroups.get(entry.localeGroup) ?? [];
    group.push(entry);
    localeGroups.set(entry.localeGroup, group);
  }
  const parts: { name: string; xml: string; urls: number }[] = [];
  let body = "";
  let bytes = encoder.encode(OPEN + CLOSE).byteLength;
  if (bytes > maxBytes) throw new SitemapProblem("limit", report(true));
  let count = 0;
  let unknown = 0;
  const finish = () => {
    parts.push({
      name: `sitemap-${String(parts.length + 1).padStart(5, "0")}.xml`,
      xml: OPEN + body + CLOSE,
      urls: count,
    });
    body = "";
    count = 0;
    bytes = encoder.encode(OPEN + CLOSE).byteLength;
  };
  for (const entry of accepted) {
    const modified = lastmod(entry);
    if (!modified) unknown++;
    const group = entry.localeGroup ? (localeGroups.get(entry.localeGroup) ?? []) : [];
    const uniqueLocales = new Set(group.map((alternate) => alternate.locale));
    const alternates = uniqueLocales.size === group.length ? group : [];
    const xml = `  <url><loc>${escapeSitemapXml(entry.url)}</loc>${modified ? `<lastmod>${modified}</lastmod>` : ""}${alternates
      .map(
        (alternate) =>
          `<xhtml:link rel="alternate" hreflang="${escapeSitemapXml(alternate.locale ?? "")}" href="${escapeSitemapXml(alternate.url)}"/>`,
      )
      .join("")}</url>\n`;
    const size = encoder.encode(xml).byteLength;
    if (encoder.encode(OPEN + CLOSE).byteLength + size > maxBytes)
      throw new SitemapProblem("limit", report(true));
    if (count && (count === maxUrls || bytes + size > maxBytes)) finish();
    body += xml;
    bytes += size;
    count++;
  }
  if (count || parts.length === 0) finish();
  if (parts.length > 50000) throw new SitemapProblem("limit", report(true));
  const id = createHash("sha256")
    .update(JSON.stringify([policy.tenantId, origin, revision, parts.map((part) => part.xml)]))
    .digest("hex");
  const index =
    INDEX_OPEN +
    parts
      .map(
        (part) =>
          `  <sitemap><loc>${escapeSitemapXml(`${origin}/sitemap-${id}-${part.name.slice(8)}`)}</loc></sitemap>\n`,
      )
      .join("") +
    INDEX_CLOSE;
  if (encoder.encode(index).byteLength > 52428800) throw new SitemapProblem("limit", report(true));
  return {
    id,
    tenantId: policy.tenantId,
    origin,
    revision,
    files: parts.map(({ name, xml }) => ({ name, xml })),
    index,
    report: {
      ...report(true),
      included: accepted.length,
      lastmodUnknown: unknown,
      files: parts.map((part) => ({
        name: part.name,
        bytes: encoder.encode(part.xml).byteLength,
        urls: part.urls,
      })),
    },
  };
}
