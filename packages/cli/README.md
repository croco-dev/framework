# Croco CLI

Croco CLI is a code generator and project scaffolding tool for Croco framework workspaces. It creates controllers, entities, events, pages, domain modules, and generates RPC clients or OpenAPI specs.

> **New to Croco?** Start with [`npx create-croco-app`](https://github.com/croco-dev/framework/tree/trunk/packages/create-croco-app) to scaffold your first SaaS API, then follow the [Getting Started guide](https://github.com/croco-dev/framework/tree/trunk/packages/docs/src/content/docs/en/guides/getting-started.mdx).

## Quick Start

```bash
pnpm exec croco --help
```

Run from any directory inside a Croco workspace. The CLI automatically detects `pnpm-workspace.yaml` to find your project root.

## Commands

| Command | Description |
|---|---|
| `make controller <Name>` | New controller class with CRUD methods |
| `make repository <Name>` | New repository class |
| `make entity <Name>` | New entity class |
| `make event <Name>` | New domain event class |
| `make listener <Name>` | New event handler |
| `create page <Name>` | Console web page (SSR or SPA) |
| `create domain <name>` | API domain module (5 files) |
| `generate scaffold <Model>` | Page + domain bundle |
| `codegen rpc [args]` | Generate RPC client code |
| `codegen openapi [args]` | Generate OpenAPI spec |
| `migrate up\|down [args]` | Run or rollback database migrations |

### make — Application Artifacts

Creates a single source file under `apps/api-server/src/`:

- `croco make controller User` creates `apps/api-server/src/controllers/UserController.ts` with `@Controller`, `@Get`, `@Post`, `@Put`, `@Delete` stubs
- `croco make repository User` creates a class extending `Repository<UserEntity, string>`
- `croco make entity User` creates an `@Entity()` class with `id`, `createdAt`, `updatedAt`
- `croco make event OrderShipped` creates a `DomainEvent` subclass
- `croco make listener SendEmail` creates an event handler registered via `@RegisterEventHandler`

### create — Project Files

- `croco create page Dashboard` generates 3 files under `apps/console-web/pages/dashboard/`
- `croco create domain Payment` generates 5 files under `apps/api-server/src/domains/payment/` plus controller registration

### generate — Bundled Scaffolds

- `croco generate scaffold Product` runs `create domain` and `create page` together in one command

### codegen — Client Code & Specs

- `croco codegen rpc [args]` delegates to `@croco/rpc-codegen`
- `croco codegen openapi [args]` delegates to `@croco/openapi-spec`

### migrate — Database Migrations

- `croco migrate up` runs pending migrations via `@croco/migration-runner`
- `croco migrate down` rolls back migrations

## Global Options

All commands support these options:

| Option | Type | Description |
|---|---|---|
| `--cwd` | `string` | Working directory (default: `process.cwd()`) |
| `--dryRun` | `boolean` | Preview changes without writing files |
| `--overwrite` | `boolean` | Overwrite existing files |

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

### page (3 files)

```
apps/console-web/pages/{name}/
  Page.tsx               # Page component
  route.ts               # Route definition
  Page.spec.tsx          # Test file
```

The `--mode` flag switches between SSR (default) and SPA rendering.

## Troubleshooting

### "No Croco workspace detected"

The CLI runs `detect()` starting from `--cwd` (or the current directory) and walks upward looking for `pnpm-workspace.yaml`. If your project uses a different layout, run the command from a subdirectory inside the workspace, or pass `--cwd` explicitly.

### codemod unsupported pattern

Commands like `create domain` use codemods to register controllers in the API server entry file. If the entry file uses an unsupported import or module pattern, the codemod may skip registration. Check the entry file format or disable auto-registration with `--no-register`.

### private: true packages

The `@croco/cli` package itself has `"private": true` and is not published to npm. Use it via `pnpm exec croco` inside the monorepo, or install from a local build.
