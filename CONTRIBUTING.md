# Contributing to Croco Framework

Welcome! This guide covers everything you need to start contributing.

## Prerequisites

- **Node.js** 22+ (see `.nvmrc`)
- **pnpm** 10+ (`npm install -g pnpm`)
- **Git**

```bash
node --version  # should be >= 22
pnpm --version  # should be >= 10
```

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/croco-dev/framework.git
cd framework

# 2. Run one-command setup (install + build + typecheck + test)
pnpm setup
```

`pnpm setup` runs `pnpm install --frozen-lockfile && pnpm build && pnpm typecheck && pnpm test` in
sequence. It fails instead of updating `pnpm-lock.yaml` when dependency declarations have drifted from
the committed lockfile. If it exits cleanly, your environment is ready.

When intentionally changing dependencies, run `pnpm setup:update`. It uses
`pnpm install --no-frozen-lockfile` before the same build, typecheck, and test sequence, so lockfile
updates remain an explicit workflow.

### Environment Variables

Most packages work without any env vars in development. If you need to configure integrations:

```bash
cp .env.example .env
# Edit .env and fill in only what your integration requires
```

See `.env.example` for the full list of supported variables with descriptions.

## Development

### Common Commands

```bash
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # TypeScript type check
pnpm check            # Run the read-only repository verification gate
pnpm format           # Format all files
```

### Working on a Single Package

Use `--filter` to scope commands to one package:

```bash
pnpm build --filter=@croco/retry-core
pnpm test --filter=@croco/retry-core
pnpm typecheck --filter=@croco/events-core
```

Run a specific test file directly:

```bash
cd packages/retry-core
pnpm exec vitest run src/tests/Retryable.spec.ts

# Or by test name
pnpm exec vitest run -t "should retry on failure"
```

## Code Style

Croco uses Oxlint for linting and Oxfmt for formatting. Key rules:

- 2-space indentation
- Single quotes
- 120-character line width
- `import type { X }` for type-only imports (required)
- No unused imports or variables
- No explicit `any`
- No non-null assertions (`!`)

Run `pnpm format` before committing to format the repository. Use `pnpm lint` and `pnpm check` for
read-only lint and repository verification.

For full naming conventions, decorator patterns, and error handling rules, see [AGENTS.md](./AGENTS.md).
Reviewed exceptions to the static failure-handling rules must follow the
[static misuse exception process](./docs/contributing/static-misuse-exceptions.md).

## Testing

Tests use [Vitest](https://vitest.dev/). Test files live at `src/tests/[ClassName].spec.ts`.

```bash
pnpm test                                          # All packages
pnpm test --filter=@croco/retry-core               # Single package
cd packages/retry-core && pnpm exec vitest run     # Direct vitest
```

Always reset the DI container in `beforeEach`:

```typescript
import { beforeEach, describe, expect, it } from "vitest";

describe("MyService", () => {
  let service!: MyService;

  beforeEach(() => {
    Container.reset();
    service = new MyService();
  });
});
```

## Validate Before Pushing

Before opening a PR, run the full validation suite:

```bash
pnpm build       # Compile all packages
pnpm typecheck   # TypeScript type check
pnpm test        # Run all tests
pnpm check       # Repository verification gate
```

Or run them all at once with `pnpm setup` (the same frozen-lockfile sequence as initial setup). Use
`pnpm setup:update` only when intentionally updating dependencies and `pnpm-lock.yaml`.

The `pre-push` hook runs auto-changeset, `pnpm test`, and a mutation-guarded `pnpm typecheck`. Run
`pnpm format`, `pnpm lint`, and `pnpm check` manually before pushing.

## Git Workflow

1. **Create a branch** from `trunk`:

   ```bash
   git checkout trunk && git pull
   git checkout -b fix-login-bug        # or feat-new-feature
   ```

2. **Make changes** and commit:

   ```bash
   git add <files>
   git commit -m "feat: add retry backoff strategy"
   ```

3. **Push and open a PR**:

   ```bash
   git push -u origin fix-login-bug
   ```

### Before You Start — External Checks

브랜치 작업을 시작하기 전 다음을 확인한다:

- [ ] 저장소의 기본 브랜치가 `trunk`로 설정되어 있는지 확인 (Repository Settings → Branches → Default branch)
- [ ] CI/CD 배지가 trunk 브랜치를 가리키는지 확인 (README badges)
- [ ] GitHub 브랜치 보호 규칙이 trunk에 적용되는지 확인 (Settings → Branches → trunk → Require pull request reviews before merging)
- [ ] 자동화 봇/리뷰어 설정이 trunk 브랜치를 대상으로 하는지 확인 (CODEOWNERS, branch protection rules)

### Branch Naming

- Feature: `feat-<description>` (e.g., `feat-billing-webhook`)
- Fix: `fix-<description>` (e.g., `fix-retry-timeout`)
- Docs: `docs-<description>`

### Commit Messages

Follow the existing style in `git log`. Most commits use conventional format:

```
feat: add exponential backoff to retry policy
fix: resolve container reset issue in tests
docs: update telemetry usage examples
```

## Git Hooks (Lefthook)

Hooks run automatically after `pnpm install`:

| Hook         | Trigger                  | What it does                                                  |
| ------------ | ------------------------ | ------------------------------------------------------------- |
| `pre-commit` | `git commit`             | Runs Oxlint `--fix` and Oxfmt `--write` on staged files       |
| `pre-push`   | `git push`               | Runs auto-changeset, tests, and mutation-guarded typechecking |
| `post-merge` | `git merge` / `git pull` | Runs `pnpm install`                                           |

The pre-commit hook auto-fixes formatting, so your commit will include the fixed files automatically.

## Project Structure

```
packages/
  framework-context/    # DI container, request context, decorators
  problems-core/        # RFC 7807 error handling
  events-core/          # Domain events (EDA)
  tx-core/              # Unit of Work transaction management
  tx-drizzle/           # Drizzle ORM transaction adapter
  retry-core/           # Retry policies, circuit breaker
  telemetry-api/        # @Trace decorator, distributed tracing
  telemetry-sdk-node/   # OpenTelemetry SDK initialization
  protocols-rest/       # REST API decorators (@Controller, @Get, ...)
  transports-http/      # Hono-based HTTP runtime + Lambda adapter
  ...                   # 50+ more packages
```

Each package follows the same layout:

```
packages/[name]/
  src/
    index.ts          # Barrel exports
    libs/             # Implementation
    tests/            # *.spec.ts files
  package.json
  tsconfig.json
```

## Documentation Architecture

| Document               | Purpose                                             | Update Trigger        |
| ---------------------- | --------------------------------------------------- | --------------------- |
| `README.md`            | Entry point, architecture overview, package catalog | Per release/milestone |
| `CONTRIBUTING.md`      | Development workflow, code style, testing guide     | Per policy change     |
| `packages/*/README.md` | Package-specific API docs, usage examples           | Per package release   |
| `AGENTS.md`            | AI coding agent conventions                         | Per convention change |

### Release Documentation Checklist

Before each release, verify documentation consistency:

- [ ] README.md package catalog tables match `ls packages/` output
- [ ] Roadmap sections updated (no stale Q\*/YYYY dates)
- [ ] New packages have READMEs with: overview, API surface, dependencies
- [ ] Deprecated/removed packages removed from catalog
- [ ] Development workflow commands still accurate

Create a "Release Checklist" issue from the template to track this process.

## Questions

For Croco CLI usage, see `packages/cli/README.md`.

Open an issue or check existing ones labeled `good first issue`.
