# Plugin composition

## Select a plugin

Use the generated [package selection](package-selection.md) as a navigation index, then inspect the linked package and executable example. The table is derived from Croco's package catalog; do not infer readiness from a package name or from a successful unit test alone.

Check each selected implementation for:

- the contract and capability it provides;
- compatibility with the project's runtime;
- package maturity: production, beta, alpha, or deprecated;
- certification: certified, uncertified, or no recorded claim;
- required configuration names and sensitive values;
- executable verification and known gaps.

## Compose explicitly

Call the package-owned plugin factory and place the returned plugin in `defineCrocoApplication({ imports: [...] })`, directly or through the selected Profile. For decorated application services and controllers, enable `crocoPlugin()` in the server build and pass its `generatedDiGraph` to `createApplicationRuntime()`. The compiler discovers classes under the app's scan root and emits their factories; do not repeat them in hand-written provider/controller lists or bootstrap imports. See [compile-time DI](https://github.com/croco-dev/framework/blob/trunk/docs/architecture/compile-time-di.md) for scan, binding, and migration boundaries.

Use `defineCrocoModule()` or compiler `di.modules` when ownership, visibility, external SDK factories, or explicit overrides actually require a boundary. Keep runtime secrets and configuration in that application-owned boundary rather than generated source.

Do not use legacy direct/global composition for new work when a canonical plugin or module exists. In particular, avoid direct `Container.set()`, package-specific global setters, raw HTTP controller or middleware arrays, and direct telemetry singleton initialization as composition mechanisms.

## Replace one owner deliberately

Single-owner provider conflicts must fail rather than depend on registration order. When the application intentionally replaces imported owners, declare `providerReplacements` with the replacement provider and every exact owner name. Missing, extra, or duplicate owners are contract errors; changing import order is not a repair.

Use multi-contributions only for intentionally aggregated surfaces such as controllers, middleware, diagnostics, lifecycle resources, event handlers, task handlers, or trigger handlers. Give each contribution a stable kind and identifier.

## No compatible implementation

If every first-party option is unavailable, incompatible with the runtime, too immature for the requested risk, or missing a required capability:

1. Keep domain and application services typed against the core contract.
2. Implement the adapter in an application-owned Plugin module, not in Kernel or Contracts.
3. Record supported runtimes, configuration names, verification, maturity, and the precise unsupported boundary.
4. Add conformance and failure-path tests appropriate to that contract.
5. Report that the adapter is application-scoped and not a certified Croco implementation.

## Workers rate limiting

`@croco/ratelimit-upstash` supports an explicit fetch-only `createUpstashRateLimitClient({ url, token })`
from Worker bindings with one selected fixed/sliding/token-bucket store per algorithm namespace.
Inject that owner through the application's module; do not auto-register an Upstash and Durable Object
owner for the same limiter. Distinct applications and algorithms require distinct prefixes. Preserve
host-verified client identity and explicitly select failOpen/failClosed. HTTP status Problems are redacted;
a retryable failure may follow a committed Lua command, so never retry consumption blindly.

The package's workerd REST fixture and Docker Redis suite prove the standalone adapter path, not a live
Upstash service, deployed Workers, DO provider certification, or full Workers SaaS profile integration.
DO remains unsupported by this package and requires its own implementation and conformance. Keep alpha
maturity and unverified live/readiness evidence explicit; numeric policy validation remains in #1687.

## AWS S3 storage

Use `s3Storage({ bucket, region, keyPrefix })` from `@croco/storage-s3` as an explicit
application import. The alpha adapter owns one SDK client per application runtime;
SDK default credentials cover Node/Lambda role and web-identity configuration without
embedding keys. Finish upload/abort cleanup and consume download streams before a
Lambda invocation ends; dispose the runtime only after all calls have drained.
Inspect `packages/storage-s3/smoke/identity-contract.json` for reference-only projected
token, IAM scope and optional secret references. Local SDK/Node/Lambda tests do not
certify AWS S3, IRSA, workload identity or deployed infrastructure. Workers isolates
are unsupported. S3 multipart, conditional writes, ACL policy and opaque ETags must
not be inferred from the R2 or Cloudinary adapter. See the package README for limits.
