# Verification

Select checks from the changed contract and the generated project's own scripts. Do not claim a provider or runtime path was exercised when credentials or a live environment were unavailable.

## Development environment support

Native Windows CLI/scaffold development environments are currently outside Croco's official
support and verification scope. Windows developers can use a Linux toolchain inside WSL2;
see [Microsoft's WSL development environment guide](https://learn.microsoft.com/ko-kr/windows/wsl/setup/environment).
Croco has not verified WSL2 itself; passing Linux CI does not certify WSL2. Support for Windows
users accessing web applications through a browser is unchanged.

## Always

1. Re-run the project inspector and confirm the intended Croco dependencies, manifests, composition roots, and verification scripts are visible.
2. Run the generated project's architecture or graph check when present, such as `architecture-policy:check`, `di:check`, `di:verify`, or `profile:check`.
3. Run the affected workspace's typecheck and focused tests.
4. Run the narrowest smoke command that exercises the changed composition without credentials.

## When selected by the change

- Public contract or plugin metadata: build and test the affected package, then verify public declarations and generated metadata.
- Host or transport change: run the runtime-capability check and a request-level smoke for the selected host/transport pair.
- Provider change: run conformance, no-credential diagnostics, redaction, retry/idempotency, and opt-in live smoke only when credentials are explicitly available.
- Generated project change: run its generated-file tests and generated-app smoke.

## Report

State the selected contract and implementation, runtime, maturity, certification state, commands that passed, and any unexecuted live or production check. For a custom adapter, identify its application-owned location and the missing first-party capability or compatibility that justified it.

## Clerk Workers authentication subset

Use the explicit `@croco/auth-clerk/workers` entry and `clerkWorkersAuth()` for the
alpha cookie/bearer subset. The root package and `clerkAuth()` retain their Node/Lambda
claims; the package-wide catalog must not recommend the entire Clerk surface on Workers.
Pass the Worker secret binding directly, and configure trusted audience, authorized parties,
authoritative tenant mapping and server target resolution. Each authenticated request reads
upstream session state; revocation and upstream availability are part of that request path.

`pnpm --filter @croco/auth-clerk test` includes actual workerd fixtures with `nodejs_compat`,
real local signatures and synthetic upstream HTTP. They verify the SDK browser crypto branch,
expiry/signature/audience/origin rejection, tenant isolation, session revoke and redacted failures.
This is not live Clerk certification. Webhook and user/organization administration remain
unclaimed on Workers. The generated `saas-cloudflare` profile exposes an opt-in
`createGeneratedWorkersAuthPlugin(options, () => import("@croco/auth-clerk/workers"))` helper
and the subset evidence. Add the optional auth package when selecting this helper. Native
bootstrap remains `bootstrap-only`; its auth capability stays unavailable until the application
connects the provider. Bootstrap health does not establish full SaaS or live Clerk certification.

## Kubernetes Node API generation

`--preset production-app --backend-deploy kubernetes` generates a minimal, uncertified
Node API infrastructure profile. Inspect `croco-infrastructure-profile.manifest.json`
alongside the Node runtime capability manifest. The SPA is deployed separately.
Run generated build/typecheck, `pnpm k8s:check` for owned-file drift, an independent
Kubernetes schema validator against `kubernetes/resources.yaml`, and `pnpm k8s:smoke`
for real Node HTTP drain/readiness/close evidence. `pnpm k8s:lock` records reviewed
file changes and clears verification claims; it never validates schemas or certifies a cluster.

A live cluster requires separate server-side validation, image/probe/Secret wiring,
controlled Pod termination and endpoint removal evidence. Without it, report
`liveCluster: not-verified` and `certification: not-certified`. One replica with Recreate
reflects the sample's process-local repository/limiter and restart data loss; durable
provider composition and shared typed binding (#3547) are separate integration work.

## Lambda HTTP API generation

`--preset production-app --backend-deploy lambda` selects the minimal API profile using
`@croco/preset-lambda`, the generated DI graph and application-owned `nodeTelemetry()`.
Inspect `croco-infrastructure-profile.manifest.json`, the Lambda runtime capability manifest
and `lambda/template.json`. Run generated `pnpm lambda:package`, `pnpm lambda:check` and
`pnpm lambda:smoke`, plus independent `sam validate --lint --template-file lambda/template.json`.
The smoke loads the production deployment directory and invokes API Gateway v2 events;
fixture auth/cookies and local concurrent context/flush tests do not prove gateway IAM.

Keep the SAM default IAM authorizer, function-scoped log permissions, execution budgets and
optional OTLP header secret reference under review. `lambda:lock` adopts reviewed hashes and
clears verification claims. Missing owned files cannot be adopted. This profile has process-local
sample storage and no async event source/DLQ, SQS, scheduler or configured SaaS providers.
It does not complete the documentation-only `saas-lambda` composition or shared binding work.
Signed/unsigned live requests, secret resolution, telemetry delivery and AWS operational checks
remain separate: `liveAws: not-verified`, `certification: not-certified` until actually verified.

## Infrastructure bindings

For resource requirements, use `defineInfrastructureRequirements` from `@croco/framework-context`
and the static validators in `create-croco-app/dist/verification.js`. Follow the
[static infrastructure contract](https://github.com/croco-dev/framework/blob/trunk/docs/architecture/infrastructure-requirements.md)
for each profile's supported native artifact, scope and permission subset. Run the generated
`pnpm infrastructure:check` before build/CI. Kubernetes generation starts with empty requirements
because the sample providers are process-local. Add real provider requirements explicitly;
never turn the optional external Secret into a verified provider claim.

Missing required bindings, supplied invalid optional bindings and stale binding claims fail.
Use references only; keep credentials out of declarations and reports. Static artifact success
is not live existence, effective authorization, executable code/image proof or certification.
SAM/CDK and Wrangler validators do not imply generated full SaaS deployment support.

## Cloudflare SaaS bootstrap

`--preset saas --saas-profile saas-cloudflare` selects a bootstrap-only Worker.
Inspect `composition.scope`, the native host plugin and each capability state separately.
`GET /ops/health` proves bootstrap readiness only; business and webhook requests return
`CROCO_SAAS_PROFILE_CAPABILITY_UNAVAILABLE` without accepting deliveries or invoking fake providers.
`profile:check` checks native env ownership and runtime graph identity; `profile:smoke:real`
refuses the unavailable full SaaS path. Run the generated app's Wrangler workerd smoke
for health, unavailable webhook and redacted invalid-binding evidence. Node-only provider
SDKs, an installed package or local bootstrap health do not establish Worker provider support
or certification. Provider implementation, connection and live-service evidence remain separate.

## Three infrastructure review

For a new public capability, Provider, Host, deployment Profile or support-changing fix, inspect the contract,
then the selected Profile metadata, Provider, runtime capability manifest and executable evidence. Evaluate:

- `kubernetes`: Node Host; Kubernetes is not a `KnownRuntimePlatform`.
- `aws-lambda`: Lambda Host; inspect invocation scope, resource reuse and flush/close ownership.
- `cloudflare`: Workers Host, or explicitly identified Node Containers; a Container is not a Worker isolate.

Record `supported | conditional | unsupported | unverified | not-applicable` for each, with provider references,
capability/storage/lifecycle limits, test/fixture/file references and reasons. Prefer existing adapters; never
copy pure contracts or domain logic for each platform. Unsupported is an acceptable outcome. Supported needs
executed host-runtime evidence; local/no-credential tests do not establish live infrastructure certification.

In the framework checkout, add a versioned, hash-bound review following
[the infrastructure review contract](https://github.com/croco-dev/framework/blob/trunk/docs/contributing/infrastructure-review.md).
Run `pnpm infrastructure-review:check -- --base <base-sha>`, `pnpm docs:catalog:check`,
`pnpm skill:write && pnpm skill:check` and the affected `pnpm check` paths after changes. Review the companion's
profile decisions and unverified surfaces. Keep catalog/runtime manifests authoritative for runtime claims;
review records are change evidence, not another provider registry. Documentation/test-only changes do not
backfill historical packages. Pure refactors use reasoned not-applicable without platform smoke.

In a generated application, use its reported manifest and verification scripts; the repository-only review
checker is not installed there. Keep the same three decisions in the application's own review evidence and
report missing Providers or host paths explicitly. Never mark untested or unsupported paths as supported.

## Workers GraphQL and tRPC

Run `pnpm --filter @croco-example/workers-protocols test` for real local workerd
query/mutation, scope, cookie, content-type, Problem and host-signal evidence.
`pnpm --filter @croco-example/workers-protocols codegen:check` verifies the generated
GraphQL SDK against the declared schema and operations. Shared GraphQL and tRPC fixtures
run through Node fetch and the Lambda host envelope. Keep client-disconnect cancellation,
subscription/streaming, deployed Cloudflare and full SaaS profile certification separate
from these local results.

## Hyperdrive transaction local evidence

`@croco/tx-drizzle/hyperdrive` is an experimental opt-in, request-owned transaction
boundary. In the framework checkout only, run `pnpm --filter @croco/tx-drizzle test` for deterministic lifecycle/error
cases and `pnpm --filter @croco/tx-drizzle test:workers` with Docker for local workerd
and PostgreSQL. Native binding emulation bypasses the deployed Hyperdrive proxy.
Keep live deployment, proxy pooling/cache/failover, domain adapter conformance and
profile integration explicitly unverified. Do not promote the root transaction plugin
or durable adapter runtime claims from these local tests. Application authorization,
transaction-local tenant settings, concurrency admission and reconciliation of an
unknown outcome remain application responsibilities; never retry a committed outcome.

The repository-only `packages/tx-drizzle/smoke` artifact supplies an authenticated Worker and
`pnpm --filter @croco/tx-drizzle smoke:verify --url <origin> --target <local|remote> --output <path>`.
The Docker-backed Worker suite runs the same CLI over local HTTP with an independent SQL observer.
Provision the dedicated schema/roles outside the Worker; the runner only mutates and cleans its own
run UUID. Secrets come from bindings/environment and are omitted from reports. A remote target
requires HTTPS and redirects fail. Remote HTTP success does not attest Cloudflare deployment or
binding identity; keep deployment, proxy pooling/cache/failover and certification unverified until
separate deployment/configuration evidence exists. Neither artifact provisions or deploys resources.
These artifacts and package scripts are not shipped in generated applications. In a generated
application, use its own declared scripts; inspect the framework repository for this local evidence.

## R2 Workers binding subset

Use `R2BindingStorageProvider` from `@croco/storage-r2/workers` with the application-owned
`env.BUCKET` binding and native `nodejs_compat`. The root S3-compatible provider retains
its Node/Lambda support. The package-wide catalog does not claim the entire package on Workers.
`pnpm --filter @croco/storage-r2 test` includes local workerd R2 binding fixtures for native
known-length upload streams, ranged reads, metadata, cancellation and bounded buffering.
This is local runtime evidence, not live Cloudflare certification. Binding operations do not
provide signed URLs or per-object ACLs and are never retried automatically. Cancellation stops
waiting and read-body consumption; a started put/delete can still commit remotely. Applications
own authenticated tenant/key selection and recovery after an uncertain write. The binding has no
shutdown/flush operation and must remain within the selected Worker callback's lifetime.

## Resend Workers email

`@croco/notifications-resend` reuses its existing `ResendProvider` in Workers with `nodejs_compat`.
Pass the API key from the application's secret binding and select the provider explicitly.
`pnpm --filter @croco/notifications-resend test` includes actual workerd with synthetic HTTP upstreams;
`pnpm --filter @croco/notifications-resend test:workers` additionally needs Docker for real PostgreSQL
dispatch, execution and ContactPolicy receipts. Keep accepted, unknown and delivered states distinct.
An accepted-but-response-lost send stays unknown until reconciled; never wrap external dispatch and
its durable pre-send evidence in one outer database transaction. Finish callback work before closing
its request-owned database connection. The SDK classifies upstream timeout failures but offers no
caller deadline or remote cancellation guarantee. These local tests do not certify live Resend,
deployed Hyperdrive, Cloudflare or the full SaaS profile. Large broadcasts need a durable Queue/Task
path; request `waitUntil` is not that path. See the package README for the opt-in composition and limits.
