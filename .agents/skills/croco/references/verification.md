# Verification

Select checks from the changed contract and the generated project's own scripts. Do not claim a provider or runtime path was exercised when credentials or a live environment were unavailable.

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
