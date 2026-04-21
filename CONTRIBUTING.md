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

# 2. Install dependencies
pnpm install

# 3. Build all packages
pnpm build

# 4. Run tests
pnpm test

# 5. Type check
pnpm typecheck
```

If all four steps pass, your environment is ready.

## Development

### Common Commands

```bash
pnpm build            # Build all packages
pnpm test             # Run all tests
pnpm typecheck        # TypeScript type check
pnpm check            # Biome lint + format check
pnpm check --write    # Auto-fix lint and format issues
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
pnpm vitest run src/tests/Retryable.spec.ts

# Or by test name
pnpm vitest run -t "should retry on failure"
```

## Code Style

Croco uses [Biome](https://biomejs.dev/) for linting and formatting. Key rules:

- 2-space indentation
- Single quotes
- 120-character line width
- `import type { X }` for type-only imports (required)
- No unused imports or variables
- No explicit `any`
- No non-null assertions (`!`)

Run `pnpm check --write` before committing to auto-fix most issues.

For full naming conventions, decorator patterns, and error handling rules, see [AGENTS.md](./AGENTS.md).

## Testing

Tests use [Vitest](https://vitest.dev/). Test files live at `src/tests/[ClassName].spec.ts`.

```bash
pnpm test                                          # All packages
pnpm test --filter=@croco/retry-core               # Single package
cd packages/retry-core && pnpm vitest run          # Direct vitest
```

Always reset the DI container in `beforeEach`:

```typescript
import { beforeEach, describe, expect, it } from 'vitest';

describe('MyService', () => {
  let service!: MyService;

  beforeEach(() => {
    Container.reset();
    service = new MyService();
  });
});
```

## Git Workflow

1. **Create a branch** from `main`:

   ```bash
   git checkout main && git pull
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

| Hook | Trigger | What it does |
|------|---------|--------------|
| `pre-commit` | `git commit` | Runs `biome check --write` on staged files |
| `pre-push` | `git push` | Runs `pnpm test` and `pnpm typecheck` |
| `post-merge` | `git merge` / `git pull` | Runs `pnpm install` |

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

## Questions

Open an issue or check existing ones labeled `good first issue`.
