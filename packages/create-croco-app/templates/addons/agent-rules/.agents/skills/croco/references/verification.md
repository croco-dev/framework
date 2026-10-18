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
