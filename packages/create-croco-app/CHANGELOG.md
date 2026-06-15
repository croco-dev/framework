# create-croco-app

## 0.0.4

### Patch Changes

- 9c034ef: - Keep Lambda scaffold handler targets covered for GraphQL and REST/tRPC generated apps.
- 40cb9f1: - fix: keep generated Meta Vite configs loadable
- 511a850: CLI generators now validate generated imports against target app manifests before writing files, and API-server scaffolds declare the common generator dependencies.
- 7db1d3f: Derive CLI version banners from each package manifest instead of hard-coded source strings.
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
- 0b49816: Generated REST SPA templates now expose OpenAPI spec export and typed RPC client generation commands backed by declared package dependencies and smoke-test coverage, and contract loaders resolve controller imports from the generated project.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- ac9118b: Add a first-class Croco application testing harness and generate an API sample test that uses it.
- Updated dependencies [51b0f14]
- Updated dependencies [9b96933]
- Updated dependencies [40b024d]
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
