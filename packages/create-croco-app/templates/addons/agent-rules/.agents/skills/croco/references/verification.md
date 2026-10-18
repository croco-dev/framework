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
