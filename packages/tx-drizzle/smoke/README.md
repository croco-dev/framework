# Hyperdrive deployment smoke harness

This repository-only Worker and Node runner reuse `withHyperdriveTransaction` from the
built package. They are validation artifacts, not a SaaS provider or a tenant authorization
implementation. Actual Cloudflare deployment remains unverified by these local results.

## Local evidence

From the repository root, with Docker available:

```sh
pnpm --filter @croco/tx-drizzle... build
pnpm --filter @croco/tx-drizzle smoke:bundle
pnpm --filter @croco/tx-drizzle test
pnpm --filter @croco/tx-drizzle test:workers
```

The live test lane self-provisions PostgreSQL 17 and a non-owner/non-BYPASSRLS Worker login,
applies `setup.sql` outside the Worker, bundles `worker.ts` through pinned Wrangler's
`deploy --dry-run` and serves that exact output using actual
workerd/Miniflare Hyperdrive emulation. It invokes `verify.mts` as a separate CLI over
HTTP with an independent PostgreSQL observer. No Cloudflare credentials are used.

The runner checks protocol and authentication, six concurrent claims, two competing CAS
updates, tenant isolation, rollback, savepoint, abort, pre-abort, statement timeout and
reconnect. Successful contention losers must return HTTP 200 with count zero. An independent
SQL connection checks persisted rows rather than trusting Worker responses. Cleanup deletes
only the fresh run UUID; unrelated runs are preserved. Negative tests reject plausible fake
HTTP results, missing database writes, redirects, oversized bodies and unsafe configuration.

Existing local tests separately cover missing binding, rejected credentials, exhausted
connections and a stalled handshake. Their documented direct-TCP negative-case limitations
still apply; this harness does not silently turn them into deployed proxy evidence.

## Prepare a future remote run

Use a dedicated smoke database. Review/apply `setup.sql` once through the existing migration
owner, never during Worker startup or verification. Create `croco_hyperdrive_smoke_worker`
with LOGIN, NOSUPERUSER and NOBYPASSRLS; it must not own the schema/table. Provision its password
separately. The SQL grants only schema usage and SELECT/INSERT/UPDATE on the smoke table.

The observer login needs BYPASSRLS (or a dedicated test superuser), schema usage and
SELECT/DELETE on this smoke table. Prefer a narrowly granted BYPASSRLS observer in the
dedicated database. The runner refuses an RLS-filtered observer because it could hide
tenant leakage and rolled-back rows. It neither creates roles nor changes permissions.

In the target account, configure Hyperdrive for that Worker login and reachable origin,
review origin TLS and connection limits, and initially disable query caching. Replace the
all-zero placeholder `hyperdrive[0].id` in `wrangler.jsonc` with the actual configuration ID.
Do not put origin passwords or smoke tokens in that file. `localConnectionString` is not
evidence of the deployed Hyperdrive service.

Supply `HYPERDRIVE_SMOKE_TOKEN` as a Worker secret with at least 32 random characters.
The Worker fails closed when it is absent/too short and requires the exact bearer token
for every endpoint. Only this smoke principal may select synthetic tenant `a` or `b`.
It accepts no caller-supplied SQL, schema, connection string or timeout. Keep the endpoint
dedicated to verification; it is not a production application authorization recipe.

The artifact uses compatibility date `2026-03-12` and `nodejs_compat`, matching local tests.
Build the PR candidate before bundling: this entrypoint is not yet an npm release. The package
pins Wrangler `4.73.0`; `smoke:bundle` always passes `--dry-run` and writes its output to
`.wrangler/smoke-build` inside this package. A future operator may use Wrangler with
`--config smoke/wrangler.jsonc`; no package script uploads/deploys or provisions resources.
Cloudflare account authentication, binding provisioning and actual deployment remain manual
and unverified. Record the Worker deployment version, source commit, Wrangler version,
Hyperdrive configuration ID, cache/TLS/connection-limit settings and database migration revision
beside any future remote report, without recording secret values.

## Verification CLI

After an operator has deployed and configured a dedicated Worker, set the runner's environment
securely:

- `HYPERDRIVE_SMOKE_TOKEN`: the same smoke principal credential as the Worker secret.
- `HYPERDRIVE_SMOKE_DATABASE_URL`: the independent observer connection to the same origin database.

From the repository root, the following command only verifies the supplied endpoint:

```sh
pnpm --filter @croco/tx-drizzle smoke:verify \
  --url https://YOUR-SMOKE-WORKER.example.com \
  --target remote \
  --output /tmp/hyperdrive-smoke-report.json
```

For an already-running local harness use `--target local --url http://127.0.0.1:PORT`.
Local mode accepts loopback HTTP only; remote mode requires HTTPS. URL credentials,
query strings, fragments and non-root base paths are rejected. Redirects fail rather than
forward the credential. Request bodies are capped at 512 bytes, response bodies at 8 KiB,
and stalled body reads are cancelled after ten seconds rather than accepting partial JSON.
Database connection/query budgets are five seconds, HTTP requests ten seconds, and the
HTTP suite has a two-minute budget. The Worker uses five-second connect/statement budgets
except its explicit 50 ms timeout test.

The CLI exits zero only when every check and UUID-scoped cleanup passes. It writes a
schema-versioned safe JSON report with the run UUID, target, check statuses and overall
result. Failure reports contain no raw URL, SQL, driver exception, token or database URI.
If failure/timeout leaves an unknown remote outcome, retain the run UUID for reconciliation;
a cleanup observation cannot guarantee that a disconnected operation never commits later.

`--target remote` means a supplied HTTPS endpoint was exercised. It cannot attest that the
endpoint is a particular Cloudflare deployment or that its binding uses the intended proxy.
Reports therefore keep `cloudflareDeployment: not-verified`,
`proxyPoolingCacheFailover: not-verified` and `certification: not-certified` even after HTTP/SQL
success. Combine the observed results with independently recorded deployment/binding evidence
before asserting actual Cloudflare verification. Domain-adapter conformance and profile
integration remain subsequent #3542 stages.
