# Resource-backed sitemaps

`generateSitemap` consumes a `SitemapSource`, independently of route templates, SSR,
warehouse or Search Console credentials. It is a Node tool in `@croco/meta-vite`.
It does not submit URLs or guarantee indexing. The limits and modification-time rules
follow [Google's sitemap guidance](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

## Source and URL ownership

The application supplies a repository snapshot and maps records to `SitemapEntry`.
`open()` returns an immutable revision and tenant. `read({revision,cursor,limit})`
must read only that revision, return no more than `limit` entries, and mark
`complete: true` **only** when the snapshot is successfully exhausted. A genuinely
empty snapshot returns no entries, `nextCursor: null`, and `complete: true`.
Repository errors must reject; do not catch them and return an empty page. Malformed
page/row frames or incompatible field types fail as source-incomplete; unknown
business decisions use the explicit null/unknown values in the source contract.

Each row declares `resourceId`, `tenantId`, absolute `url`, `canonical`, publication
state and explicit indexability. Resource IDs must be opaque application keys, not
credentials or personal data; authorized reports can display these keys. Only public, indexable, self-canonical rows survive.
Unknown publication/indexability/canonical decisions are excluded. Use the same
page definition as the PDP's canonical/publication decision when one exists; this
API does not infer such decisions from route templates. Revision identifiers use
1–256 ASCII letters, digits, periods, underscores, colons or hyphens. A resource ID
identifies one canonical page per locale; include a public variant dimension in the
identity when query-based variants represent distinct pages.

`approveUrl` is required server-owned policy. Validate approved public paths and
tenant ownership there, including sensitive path segments. The generator also
rejects other origins, credentials, fragments, control characters, email-like paths,
unknown/repeated query parameters, URLs of 2,048 or more characters and sensitive query names. `queryValues` lists
the exact meaningful public values allowed for each query key; nothing is silently
removed. This allowlist cannot make sensitive query names public.

```typescript
import { createSitemapHandler, FileSitemapPublisher } from "@croco/meta-vite";
import type { SitemapSource, SitemapAccess } from "@croco/meta-vite";

export function sitemapEndpoints(
  source: SitemapSource,
  authorize: (request: Request) => Promise<SitemapAccess | null>,
) {
  const publisher = new FileSitemapPublisher("/var/lib/shop/sitemaps");
  return createSitemapHandler({
    source,
    publisher,
    policy: {
      tenantId: "shop",
      origin: "https://shop.example",
      approveUrl: (url) => /^\/products\/[a-z0-9-]+$/.test(url.pathname),
      queryValues: { edition: ["blue", "standard"] },
    },
    authorize,
  });
}
```

Call the returned handler before the application's page/fallback handler. It returns
`null` for unrelated paths. It serves `/sitemap.xml`, root-level immutable
`/sitemap-<generation>-<part>.xml` files, `/robots.txt` and `/admin/sitemap`.
Root-level shard URLs can describe all public product paths. If the application
already owns robots.txt, compose its existing rules with the absolute
`Sitemap: https://shop.example/sitemap.xml` reference rather than shadowing them.
Until the first successful publication, public sitemap routes return 503 without
cache storage. GET and HEAD are supported; mutation through these routes is rejected.

For storage-backed XML, pass the configured `StorageProvider` as the second
`FileSitemapPublisher` argument. It uses the existing `put`/`get` contract, with
private objects under `sitemaps/<generation>/`; the application endpoint serves them.
The shared filesystem still owns completion and current-pointer coordination.
StorageProvider alone does **not** provide distributed compare-and-swap.

## Determinism and limits

The bounded scan defaults to 1,000 rows/page, 10,000 pages and 1,000,000 scanned
rows, including excluded rows. Set smaller bounds for the application's memory and
execution budget. The generator materializes up to this bound; it is not an
unbounded streaming sorter. A failed/changed snapshot, cursor loop, oversized page
or exhausted bound fails the operation and cannot replace current publication.

After validation, canonical URLs are deduplicated and sorted before partitioning.
Conflicting resource/locale/modification claims for one canonical exclude the
entire canonical group. A resource/locale identity claiming different canonical URLs
also excludes every conflicting claim. Matching duplicates count separately. Files split at
50,000 URLs or 52,428,800 UTF-8 bytes including XML wrappers, whichever comes first.
Smaller per-file limits are available; larger limits are rejected. A single entry
that cannot fit fails generation. Indexes are bounded by the same protocol limits.
The generation ID hashes tenant, origin, source revision and ordered XML bytes;
input page size and order do not change the output for the same snapshot.

`contentModifiedAt` is a source assertion about a significant content change, in
ISO date or timestamp form. Missing or invalid date strings are omitted and counted as
`lastmodUnknown`. No clock, build time or storage upload time substitutes for it.
`locale` plus `localeGroup` produces alternates only among included real canonical
rows in the group. Ambiguous duplicate locale labels suppress that group's
alternates; no language URL is fabricated.

## Publication, retry and retention

All publishers for **one site and tenant** must share the same persistent POSIX
directory and the same storage provider/namespace. Do not reuse that directory or
namespace across sites. Each publish requires an authenticated actor, idempotency
key and expected current generation ID (`null` for the first publication).

Publication acquires an exclusive directory lock, checks the expected pointer,
finishes immutable shard/index writes, atomically installs a local completion marker,
and atomically renames a new current pointer. Readers see the old complete index
until the final rename. Completed generations are never rewritten. Concurrent or
stale writers fail with `SitemapProblem.reason === 'conflict'`; they must reload and
make an explicit decision before retrying. A retry of the current command with the
same key, actor and generation returns the existing publication. Keys are not a
permanent command ledger: retries after a later command are governed by expected
generation comparison.

After a scan/write failure, restart generation from `open()`; never resume a cursor
against a new revision. Partial generations have no completion marker and cannot
be served. Reusing the same retained snapshot reproduces the same complete bytes.
Process failure while holding `publish.lock` fails closed: inspect the owning
process and staged files, confirm no writer remains, then remove only that lock.
There is no automatic lease expiry that could admit two writers. Atomic rename
protects process-level publication, not power-loss durability or eventual-consistency
object stores; use a coherent provider with read-after-write semantics.

Previous complete generations and failed staging objects are retained. This keeps
older fetched indexes valid. Operator-managed cleanup must preserve current and any
generation still referenced by cached indexes; no automatic deletion policy is
assumed. Removing the coordinator directory loses the current pointer and completion
history even when XML objects remain in storage. Back it up with the site's state.

## Administrator boundary

`authorize` must authenticate the server session and derive actor, tenant and
permissions from server-owned authorization data. Never construct its result from
POST actor/tenant fields. The browser reads the source revision and carries revision,
current generation and a fresh idempotency key in hidden form fields; operators
preview counts and exclusions before enabling Publish. HTTP clients must supply
these same checked command fields. Every administrator request needs `sitemap:read` and the
configured tenant. POST additionally requires `sitemap:regenerate` or
`sitemap:publish`, exact same-origin form submission, an expected source revision
and an idempotency key. Publishing also compares expected generation. The source is
regenerated and its revision checked before publication; arbitrary client XML or
preview objects are never accepted. Apply the application's normal request-body,
rate and execution budgets before this handler.

The HTML report exposes scanned/included counts, exclusions by reason, unknown
lastmod, completeness, per-file URL/byte counts and the last successful revision.
Denied actions are disabled and remain forbidden on the server. Source failures
return an explicit incomplete report with status 503 while retaining current.
Reports include at most 100 deterministically sorted resource/reason details, with
per-resource counts and publication state where relevant; a truncation indicator
keeps the complete aggregate counts distinct from this bounded detail sample.
Non-opaque identifiers are masked as SHA-256 references and other-tenant identifiers
are hidden. Reports do not include excluded raw URLs or connection errors. Keep
`current.json` and the coordinator directory outside public asset roots; only the
authorized report endpoint exposes report metadata.

## Infrastructure decisions and evidence

- Kubernetes/Node: the local HTTP path is tested. All replicas need the same
  persistent POSIX coordinator and coherent object namespace; cluster deployment
  and provider certification are not verified.
- AWS Lambda: conditional on a shared persistent POSIX mount (for example an
  application-owned EFS mount), bounded snapshots, and awaiting all work before
  invocation completion. `/tmp` is not a distributed or durable coordinator.
  There is no live Lambda/EFS verification in this change.
- Cloudflare Workers: this Node filesystem coordinator is unsupported in isolates.
  Generate artifacts in a Node build pipeline or use an explicitly selected Node
  Container with persistent shared storage; no Container deployment is certified.
  Existing meta-vite Workers rendering support is unchanged.

The synthetic source, XML parser, 50,001-URL and actual 50-MiB tests exercise
generation independently of providers. Partial-write and competing-writer tests
exercise the local coordinator with the existing in-memory StorageProvider (not a
live object-store certification). The real HTTP test reads generated XML and robots;
the browser fixture exercises keyboard publication, mobile layout, denied writes
and incomplete-source preservation.
