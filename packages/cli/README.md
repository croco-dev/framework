# Croco CLI

Croco CLI is a code generator and project scaffolding tool for Croco framework workspaces. It creates controllers, entities, events, pages, domain modules, and generates RPC clients or OpenAPI specs.

> **New to Croco?** Start with [`npx create-croco-app`](https://github.com/croco-dev/framework/tree/trunk/packages/create-croco-app) to scaffold your first SaaS API, then follow the [Getting Started guide](https://github.com/croco-dev/framework/tree/trunk/packages/docs/src/content/docs/en/guides/getting-started.mdx).

## Quick Start

```bash
pnpm exec croco --help
```

Run from any directory inside a Croco workspace. The CLI automatically detects `pnpm-workspace.yaml` to find your project root.

## Commands

| Command                                 | Description                                      |
| --------------------------------------- | ------------------------------------------------ |
| `make controller <Name>`                | New controller class with CRUD methods           |
| `make repository <Name>`                | New repository class                             |
| `make entity <Name>`                    | New entity class                                 |
| `make event <Name>`                     | New domain event class                           |
| `make listener <Name>`                  | New event handler                                |
| `create page <Name>`                    | Console web page (SSR or SPA)                    |
| `create domain <name>`                  | API domain module (5 files)                      |
| `generate scaffold <Model>`             | Page + domain bundle                             |
| `codegen rpc [args]`                    | Generate RPC client code                         |
| `codegen openapi [args]`                | Generate OpenAPI spec                            |
| `doctor [path]`                         | Diagnose workspace boundaries and setup          |
| `migrate up\|down\|status [args]`       | Run, rollback, or inspect database migrations    |
| `upgrade [paths...] [--write]`          | Report and apply safe version migration codemods |
| `jobs list\|show\|logs\|cancel\|replay` | Inspect and recover Croco background jobs        |
| `ops check\|status <url>`               | Validate or inspect operational endpoints        |

### make — Application Artifacts

Creates a single source file under `apps/api-server/src/`:

- `croco make controller User` creates `apps/api-server/src/controllers/UserController.ts` with `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete` stubs
- `croco make repository User` creates a class implementing `Repository<UserEntity, string>`
- `croco make entity User` creates a plain entity class with `id`, `createdAt`, `updatedAt`
- `croco make event OrderShipped` creates a `DomainEvent` subclass
- `croco make listener SendEmail` creates an event handler registered via `@RegisterEventHandler`

### create — Project Files

- `croco create page Dashboard` generates 2 runtime files under `apps/console-web/pages/dashboard/`
- `croco create domain Payment` generates 5 files under `apps/api-server/src/domains/payment/` plus controller registration

### generate — Bundled Scaffolds

- `croco generate scaffold Product` runs `create domain` and `create page` together in one command

### codegen — Client Code & Specs

- `croco codegen rpc [args]` delegates to `@croco/rpc-codegen`
- `croco codegen openapi [args]` delegates to `@croco/openapi-spec`

### migrate — Database Migrations

- `croco migrate up` runs pending migrations via `@croco/migration-runner`
- `croco migrate down` rolls back migrations
- `croco migrate status` shows executed and pending migration status

### upgrade — Version Migration Assistant

- `croco upgrade apps/console-web` scans source files and prints a dry-run migration report.
- `croco upgrade apps/console-web --write` applies only safe codemods and keeps uncertain findings as confirmation items.
- Dry-run and write reports include before/after hunks for every safe codemod so changes are reviewable before commit.
- Initial rules cover generated SPA `routeConfig` files with a confirmation-required `@croco/meta-vite` `defineRoute` suggestion, `Problem.code` matchers safely migrating the legacy HTTP security diagnostic code to `CROCO_HTTP_SECURITY_001`, and manual-only reporting for legacy compatibility strings or disabled HTTP security validation.

### doctor — Workspace Diagnostics

- `croco doctor --json` finds the nearest `pnpm-workspace.yaml`, discovers workspace packages, and prints a machine-readable report for CI.
- `croco doctor apps/api-server` runs the same checks from a specific workspace path.
- Doctor checks workspace dependency ranges, installed/built Croco spine packages, ContractGraph snapshots, ProblemRegistry artifacts, runtime capability manifests, HTTP security middleware, DI graph manifests, provider profile certification, repository-core boundaries, and Lambda telemetry flush evidence.
- Failures emit stable `CROCO_DOCTOR_*` diagnostic codes with cause, source location, and recovery action. Legacy slash-form codes remain in JSON as `legacyCode` only where they existed before.

#### `croco.doctor.v1` JSON contract

`croco doctor --json` returns a versioned report with `version: "croco.doctor.v1"`. Generated apps,
CI release gates, and local machine checks may treat these fields as a 1.0 compatibility contract:

| Field          | Contract                                                                                |
| -------------- | --------------------------------------------------------------------------------------- |
| `version`      | Literal schema version, currently `croco.doctor.v1`.                                    |
| `rootDir`      | Absolute workspace root path, or `null` when workspace discovery fails.                 |
| `packageCount` | Number of discovered workspace packages.                                                |
| `summary`      | `healthy` when no error diagnostics exist; otherwise `issues_detected`.                 |
| `checks`       | Ordered check results with `id`, `title`, `status`, `diagnostics`, and optional `note`. |
| `diagnostics`  | Flattened copy of every diagnostic emitted by every check.                              |

Each check uses `status: "pass" | "fail" | "skipped"`. Each diagnostic uses
`severity: "error" | "warning"`, a stable `code`, optional `legacyCode`, the emitting `checkId`,
human-readable `cause`, a nullable `location`, and a recovery `action`. Diagnostic locations may
include `file`, `line`, and `packageName`; new location fields must be additive.

New doctor checks should be appended with a new stable check `id`. New diagnostics should use a new
stable code. Removing or renaming existing report fields, check ids, diagnostic fields, severity
values, status values, or diagnostic codes is a breaking JSON contract change and must either bump
the report version or be called out in release notes with a migration path. Additive optional fields,
new checks, and new stable codes remain compatible with `croco.doctor.v1`.

Current stable doctor diagnostic codes are:

- `CROCO_CLI_DOCTOR_001`
- `CROCO_CLI_DOCTOR_002`
- `CROCO_CLI_DOCTOR_003`
- `CROCO_CLI_DOCTOR_004`
- `CROCO_CLI_DOCTOR_005`
- `CROCO_CLI_PROJECT_MAP_008`
- `CROCO_CLI_PROJECT_MAP_009`
- `CROCO_DOCTOR_WORKSPACE_VERSION_CONFLICT`
- `CROCO_DOCTOR_SPINE_PACKAGE_NOT_INSTALLED`
- `CROCO_DOCTOR_SPINE_PACKAGE_MANIFEST_INVALID`
- `CROCO_DOCTOR_SPINE_PACKAGE_NOT_BUILT`
- `CROCO_DOCTOR_CONTRACT_GRAPH_MISSING`
- `CROCO_DOCTOR_CONTRACT_GRAPH_INVALID`
- `CROCO_DOCTOR_CONTRACT_GRAPH_ERRORS`
- `CROCO_DOCTOR_PROBLEM_REGISTRY_MISSING`
- `CROCO_DOCTOR_PROBLEM_REGISTRY_INVALID`
- `CROCO_DOCTOR_PROBLEM_REGISTRY_DRIFT`
- `CROCO_DOCTOR_PROBLEM_REGISTRY_CHECK_TIMEOUT`
- `CROCO_DOCTOR_PROBLEM_REGISTRY_CHECK_FAILED`
- `CROCO_DOCTOR_RUNTIME_CAPABILITY_MANIFEST_MISSING`
- `CROCO_DOCTOR_RUNTIME_CAPABILITY_MANIFEST_INVALID`
- `CROCO_DOCTOR_HTTP_SECURITY_VALIDATION_DISABLED`
- `CROCO_DOCTOR_HTTP_SECURITY_MIDDLEWARE_MISSING`
- `CROCO_DOCTOR_DI_GRAPH_MANIFEST_INVALID`
- `CROCO_DOCTOR_DI_BOOTSTRAP_ERRORS`
- `CROCO_DOCTOR_PROVIDER_PROFILE_INVALID`
- `CROCO_DOCTOR_PROVIDER_PACKAGE_MISSING`
- `CROCO_DOCTOR_PROVIDER_CERTIFICATION_GAP`
- `CROCO_DOCTOR_PROVIDER_CERTIFICATION_DOCUMENTED`

In this repository, `pnpm run doctor` builds the CLI and runs `croco doctor` against the current workspace.

### jobs — Background Job Operations

Jobs commands inspect a Croco app that exposes the Jobs v1 `/jobs` operations surface. The CLI
appends `/jobs` to the supplied URL, so pass the app base URL for `/jobs` or the operations base URL
for generated SaaS apps that expose `/ops/jobs`.

```bash
croco jobs list --url https://api.example.com --status failed
croco jobs show exec_123 --url https://api.example.com
croco jobs logs exec_123 --url https://api.example.com
croco jobs cancel exec_123 --url https://api.example.com --reason "operator stop"
croco jobs replay exec_123 --url https://api.example.com --reason "provider restored"

croco jobs list --url http://localhost:3000/ops
```

Set `CROCO_JOBS_URL` to omit `--url`. `--json` prints machine-readable output. `list` and `show`
return a non-zero exit code when any reported job needs operator attention.

### ops — Operational Checks

- `croco ops check http://localhost:3000 --token "$CROCO_DIAGNOSTICS_TOKEN" --json` checks `/health`, `/ready`, and `/diagnostics` and exits non-zero when required endpoints fail.
- Add `--metrics` to include optional `/metrics` in the report.
- `croco ops status http://localhost:3000 --json` reads the same operational surface for inspection and includes `/metrics` by default.

## Global Options

All commands support these options:

| Option        | Type      | Description                                  |
| ------------- | --------- | -------------------------------------------- |
| `--cwd`       | `string`  | Working directory (default: `process.cwd()`) |
| `--dryRun`    | `boolean` | Preview changes without writing files        |
| `--overwrite` | `boolean` | Overwrite existing files                     |

## Workspace Detection

Commands call `detect()` from `@croco/cli`, which walks up the directory tree looking for `pnpm-workspace.yaml`. When found, it checks for:

- `apps/api-server/package.json` (`hasApiServer`) — required for `make` and `create domain`
- `apps/console-web/package.json` (`hasConsoleWeb`) — required for `create page`

The search stops after a configurable maximum depth. If no workspace is found, commands return an error.

## Generated File Structure

### domain (5 files)

```
apps/api-server/src/domains/{name}/
  {Name}Controller.ts    # REST endpoints
  {Name}Service.ts       # Business logic
  {Name}Repository.ts    # Data access
  {Name}Entity.ts        # Domain model
  index.ts               # Barrel exports
```

Running `croco create domain Payment` with `--register` also adds the controller to the API server entry file.

### page (2 files)

```
apps/console-web/pages/{name}/
  Page.tsx               # Page component
  route.ts               # Route definition
```

The `--mode` flag switches the route template between SSR (default) and SPA rendering. SSR routes are supported for console web apps that declare `@croco/meta-vite` and generate a `defineRoute(route)` export typed with `PageRouteDefinition`, matching the current app templates. SPA routes are the explicit legacy `@croco/frontend-vite` path and generate `routeConfig`. If a scaffold manifest only supports the other mode, the CLI reports that before writing files.

## Troubleshooting

### "No Croco workspace detected"

The CLI runs `detect()` starting from `--cwd` (or the current directory) and walks upward looking for `pnpm-workspace.yaml`. If your project uses a different layout, run the command from a subdirectory inside the workspace, or pass `--cwd` explicitly.

### codemod unsupported pattern

Commands like `create domain` use codemods to register controllers in the API server entry file. If the entry file uses an unsupported import or module pattern, the codemod may skip registration. Check the entry file format or disable auto-registration with `--no-register`.

### CLI package usage

Use `pnpm exec croco` inside a Croco workspace, or install `@croco/cli` as a dev dependency when a generated project needs CLI helpers in package scripts.
