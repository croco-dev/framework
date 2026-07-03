# create-croco-app

## 0.1.0

### Minor Changes

- 9806f31: Add goal-first app generation with `--goal` and a generated `croco.app.json` contract.
- 87448a1: Generated SaaS apps can declare a tenant model manifest with drift-checked playbook, schema, and migration guidance.

### Patch Changes

- 9c034ef: - Keep Lambda scaffold handler targets covered for GraphQL and REST/tRPC generated apps.
- 4d8f094: - Generated REST/Lambda and Cloudflare worker apps now bootstrap with the required HTTP security middleware instead of disabling security validation.
  - Missing required HTTP security middleware now fails with `CROCO_HTTP_SECURITY_001` while preserving the previous slash-form code as `legacyCode`.
- 40cb9f1: - fix: keep generated Meta Vite configs loadable
- d281518: - fix: close package docs coverage gaps
- e9820b9: Add an admin-console starter preset with typed generated client usage, tenant-scoped admin resources, Problem-aware UI state, operations timeline, and generated-app smoke coverage.
- 61d57ce: `create-croco-app --preset ai-saas` now generates a SaaS Golden Path app with tenant-metered AI text generation, canonical LLM usage meters, redacted invocation logs, quota smoke coverage, and documented provider seams.
- 7fe26a3: Generated blank and DDD base preset projects now include first-run README guidance.
- 511a850: CLI generators now validate generated imports against target app manifests before writing files, and API-server scaffolds declare the common generator dependencies.
- 7db1d3f: Derive CLI version banners from each package manifest instead of hard-coded source strings.
- f81bcf7: `@croco/frontend-cloudflare` now has beta Worker SSR evidence for service-binding API routing, assets fallback, streaming `Response` preservation, Cloudflare RuntimeContext propagation, and deterministic failure behavior. The generated Cloudflare meta-vite fullstack profile now exports a real Worker SSR handler and smoke-tests the Worker boundary.
- 529c7fd: Contract graph snapshots now include consumer coverage reports, OpenAPI/RPC generation verifies every graph route, generated RPC clients expose route metadata, and generated app CI contract scripts write `contract-graph.coverage.json`.
- 0475520: Generated REST app templates now include a CI-oriented contract verification gate that checks snapshot drift before regenerating OpenAPI and RPC client artifacts.
- f3951f3: REST route contracts can now drive controller decorators directly through contract-aware HTTP method, parameter, body, and response helpers. Contract graphs preserve route contract identity/source locations and report drift when controller bindings or response metadata diverge from the contract. The SPA split starter template now uses contract-first REST routes for its generated OpenAPI/RPC contract path.
- 6148ed3: Expose a canonical REST contract graph with route diagnostics and add a contract check path before OpenAPI and RPC client generation.
- 988f072: Add deterministic contract graph snapshots and drift gates for contract-first release checks.
- e44988b: CLI runs now report structured diagnostics with recovery text and successful generation next-step commands, with `--json` output available for noninteractive consumers.
- 612a8f9: Render Docker turbo filters from generated package names so scaffolded Docker files target existing workspace packages.
- 7079854: Generated app scaffolds now include install/build smoke coverage and template fixes so representative GraphQL Lambda API and tRPC Next.js fullstack projects install and build successfully.
- f46f834: Generated GraphQL Lambda API scaffolds now declare the Apollo Lambda integration dependency required by the Lambda handler, keep that Lambda-only package out of non-Lambda GraphQL apps, and include scoped shared-package TypeScript configs for clean generated-project typechecks.
- 845dec4: Generated app package manifests now rewrite external `@croco/*` workspace ranges to installable published ranges before dependency installation while preserving generated app-internal workspace dependencies.
- a2ed3bf: Generated Croco apps now state and enforce pnpm for dependency installation.
- 0ee21dc: Render Handlebars placeholders in text addon files even when the template filename does not end in `.hbs`.
- f4560b0: Generated-app smoke coverage now follows the supported option matrix, and Docker frontend deploy projects emit a web Dockerfile.
- 3d92b2e: Wire SSR template routes to generated page component values and expose the page data function type used by the SSR fixture.
- 6c159a3: Validate noninteractive CLI option combinations before generating project files.
- 5e54f30: - fix: keep create app db optional in noninteractive mode
- 5403360: HTTP apps now expose a DI bootstrap validation policy that fails fast by default, with explicit warn/off migration modes for legacy unregistered providers.
- f8842d3: - Generated SaaS and AI SaaS apps now include failure drill smoke scripts backed by deterministic `@croco/testing` scenarios for Problem, recovery, telemetry, and audit evidence.
- 2e65be0: Provide a shared browser-safe Problem client runtime and let generated clients import it explicitly.
- e71cb05: Promote the React presentation integration to beta evidence with package-level page data tests and generated Meta Vite fullstack hydration smoke.
- fe0a955: Frontend Vite generated profiles now prove SPA browser builds and meta-vite generated app builds with documented optional Cloudflare peer diagnostics.
- 0b49816: Generated REST SPA templates now expose OpenAPI spec export and typed RPC client generation commands backed by declared package dependencies and smoke-test coverage, and contract loaders resolve controller imports from the generated project.
- d733641: Generated workspaces now use pnpm's supported build-script allowlist key, and the generated-app smoke matrix now publishes template coverage results as CI artifacts.
- 8d2ebae: - Remove unreachable compatibility fixtures from the shipped top-level template surface so generated smoke accountability covers every published template directory directly.
- fff8f32: GraphQL APIs can now persist deterministic SDL contract snapshots with Croco resolver metadata, and generated GraphQL apps run snapshot drift checks in their default build/typecheck path.
- d04a78e: Generated SaaS apps now prove Jobs v1 operator workflows through CLI-backed smoke coverage, including attention
  exit codes and replay inspection semantics.
- af9f355: - Expose Jobs v1 operations for listing, inspecting, logging, cancelling, and replaying executions.
  - Add `croco jobs` commands for Jobs v1 operator inspection and recovery flows.
  - Support QStash schedule sync dry-runs before applying schedule changes.
  - Make batch chunk execution completion explicit for multi-step checkpoint flows.
  - Include a smoke-tested billing sync background job in the SaaS app preset.
- 4ae3a6d: Add lifecycle rules that turn SaaS health, onboarding, billing, and usage signals into observable retention actions.
- 15482d7: LLM usage governance now has provider conformance coverage, versioned pricing registries, quota enforcement, and generated SaaS smoke evidence.
- 6d3f54a: Presentation package docs now describe `@croco/meta-vite` as the Croco-native SSR/RSC runtime, while retained Vike preset naming is marked as legacy compatibility for generated meta-vite profiles.
- d4c83f1: Generated meta-vite profiles now include a presentation smoke command that dispatches page, API, server-action, and ISR routes against current Croco presentation package artifacts.
- 9556d22: Add CI-oriented operational checks with token-guarded diagnostics smoke coverage and app-provided diagnostics provider registration.
- 9b4dd2a: Add a production-app starter preset with REST API, React SPA, telemetry, Problem handling, retry/event/repository wiring, Lambda entrypoint, and generated smoke validation.
- 9a2040b: Generated contract workflows now emit a schema-versioned `.croco/manifest` bundle, validate it through the Project Map drift gate and `croco doctor`, and reference it from generated OpenAPI and RPC outputs.
- 1dbb0e8: Expose a Project Map manifest command and generated-app drift check scripts.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 14bd9f8: - Runtime capability manifests can now be emitted and compared for Node, Lambda, and Cloudflare Workers with deterministic `RuntimeCapabilityManifest v1` output.
  - Unsupported runtime capability use now carries the stable `CROCO_RUNTIME_CAPABILITY_001` diagnostic context.
  - Generated apps now write `croco-runtime-capability.manifest.json`, and doctor/smoke checks validate the manifest for supported runtime targets.
- c54e7b5: Runtime policy capability requirements can now be checked against typed runtime presets before app execution.
- 713c11e: - Harden the generated SaaS golden path with a versioned smoke contract, entitlement-backed seat limits, billing-backed entitlement plan sync, provider profile docs, and explicit demo endpoint gating.
- e4ced73: `create-croco-app --preset saas` now generates a smoke-tested SaaS golden path baseline.
- 37381fa: SaaS presets can select production provider profiles and now emit profile manifests, env contracts, deploy notes, and profile smoke checks.
- e7c4ce7: Add a static architecture policy engine and CLI gate for package/layer boundaries, public entrypoint imports, and generated SaaS app policy manifests.
- f8e4056: Generated app REST routes now declare schema-backed contract decorators, and protocols-core is included in the staged strict contract typecheck gate.
- bb59160: - Generated REST contract gates can now run strict schema diagnostics that fail before RPC/OpenAPI
  generation when routes omit response, body, path, query, or header schemas.
- e5361bc: Generated standalone Next web apps and shared UI components now use StyleX instead of Tailwind CSS, while Vite-owned frontend presets avoid receiving default Next web app files.
- ac9118b: Add a first-class Croco application testing harness with HTTP, event dispatch, request context, transaction, and telemetry helpers, and generate an API sample test that uses it.
- 9ad65a3: Generated RPC clients now expose a package barrel, preserve JSON-safe literal/enum/union/record schema types, and fail generation for unsupported Zod schemas instead of widening contracts through implicit fallback types.
- 53e9489: `croco generate usage-dashboard` now creates a tenant usage dashboard API with quota and overage states, and the SaaS preset seeds dashboard-ready normal and over-quota usage data without external credentials.
- Updated dependencies [51b0f14]
- Updated dependencies [9b96933]
- Updated dependencies [40b024d]
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [ad2e4f3]
  - @croco/telemetry-sdk-node@0.0.4
  - @croco/problems-core@0.0.4

## 0.0.3

### Patch Changes

- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/telemetry-sdk-node@0.0.3
  - @croco/problems-core@0.0.3
