# Croco CLI

Croco CLI is a code generator and project scaffolding tool for Croco framework workspaces. It creates controllers, entities, events, pages, domain modules, and generates RPC clients or OpenAPI specs.

> **New to Croco?** Start with [`npx create-croco-app`](https://github.com/croco-dev/framework/tree/trunk/packages/create-croco-app) to scaffold your first SaaS API, then follow the [Getting Started guide](https://github.com/croco-dev/framework/tree/trunk/packages/docs/src/content/docs/en/guides/getting-started.mdx).

## Quick Start

```bash
pnpm exec croco --help
```

Run from any directory inside a Croco workspace. The CLI automatically detects `pnpm-workspace.yaml` to find your project root.

## Commands

| Command                                 | Description                                   |
| --------------------------------------- | --------------------------------------------- |
| `make controller <Name>`                | New controller class with CRUD methods        |
| `make repository <Name>`                | New repository class                          |
| `make entity <Name>`                    | New entity class                              |
| `make event <Name>`                     | New domain event class                        |
| `make listener <Name>`                  | New event handler                             |
| `create page <Name>`                    | Console web page (SSR or SPA)                 |
| `create domain <name>`                  | API domain module (5 files)                   |
| `generate scaffold <Model>`             | Page + domain bundle                          |
| `codegen rpc [args]`                    | Generate RPC client code                      |
| `codegen openapi [args]`                | Generate OpenAPI spec                         |
| `doctor [path]`                         | Diagnose workspace boundaries and setup       |
| `migrate up\|down\|status [args]`       | Run, rollback, or inspect database migrations |
| `jobs list\|show\|logs\|cancel\|replay` | Inspect and recover Croco background jobs     |
| `ops check\|status <url>`               | Validate or inspect operational endpoints     |

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

### doctor — Workspace Diagnostics

- `croco doctor --json` finds the nearest `pnpm-workspace.yaml`, discovers workspace packages, and prints a machine-readable report for CI.
- `croco doctor apps/api-server` runs the same checks from a specific workspace path.
- Current blocking diagnostics include `doctor/repository-core-drizzle-boundary` and `doctor/lambda-telemetry-flush-missing`. Each failure reports the cause, source location, and recovery action.

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
