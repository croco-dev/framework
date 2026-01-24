# CROCO FRAMEWORK - AGENT KNOWLEDGE BASE

**Generated:** 2026-01-24
**Project:** Opinionated Node.js framework (AWS Lambda + API Gateway v2 first-class)

## OVERVIEW
Croco is a 4-layer architecture framework (Contexts/Protocols/Transports/Integrations) built with TypeScript, DDD patterns, and serverless optimization in mind.

## STRUCTURE
```
croco/
├── packages/              # pnpm workspace monorepo
│   ├── events-core/       # DDD event system
│   ├── events-inmemory/   # In-memory event bus
│   ├── tx-core/          # Transaction management
│   ├── tx-drizzle/       # Drizzle ORM adapter
│   ├── problems-core/     # RFC 7807 error handling
│   ├── framework-context/ # Context + DI + Metadata
│   ├── utils-node/       # Node utilities (Dreprecated)
│   ├── gid-core/         # Global ID generator
│   └── esbuild-plugin/   # Build plugin
├── shared/               # Internal configs (@croco/*)
└── template/             # Package template
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| Core events | `packages/events-core/src/libs/` | EventBus, DomainEvent, AggregateRoot |
| Transactions | `packages/tx-core/src/libs/` | AsyncLocalStorage-based UoW |
| Context management | `packages/framework-context/src/libs/` | Request scoping, DI, metadata |
| Error handling | `packages/problems-core/src/libs/` | ProblemDetails RFC 7807 |
| ESLint config | `packages/shared/utils-eslint-config/src/configs/` | Base + React configs |
| TS configs | `packages/shared/utils-tsconfig/` | base.node, react, next |

## CONVENTIONS

### Build System
- **All packages**: `tsup src/index.ts --format esm,cjs --minify --clean --dts`
- **Dev**: `main: "./src/index.ts"`, **Publish**: `publishConfig.main: "./dist/index.js"`
- **Turbo**: Caches build/test/lint tasks with dependency chains

### Package Structure
```
packages/{name}/
├── src/
│   ├── libs/          # Core implementation files
│   └── index.ts       # Explicit named exports
├── package.json       # Standard scripts: build, deploy, lint, typecheck
├── tsconfig.json      # Extends @croco/utils-tsconfig
└── eslint.config.mjs   # Extends @croco/eslint-config
```

### Import Ordering
```typescript
// 1. Internal (@croco/*)
import { EventBus } from '@croco/events-core';
// 2. External (npm)
import { Container } from 'typedi';
// 3. Builtin (Node.js)
import { AsyncLocalStorage } from 'async_hooks';
// 4. Relative
import { MyClass } from './libs/MyClass';
```

### Export Style
```typescript
export { ClassName } from './libs/FileName';
export type { InterfaceName } from './libs/FileName';
// NEVER: export * patterns (except utils)
```

### TypeScript Settings
- **Strict mode enabled** (`@croco/utils-tsconfig/tsconfig.base.json`)
- **Decorators supported** (`experimentalDecorators: true`)
- **Reflect-metadata required** for all packages

### Code Style
- **Prettier**: `singleQuote: true`, `printWidth: 120`, `trailingComma: 'es5'`
- **Type imports**: Prefer `import type` over `import` where possible

### Naming Conventions
- **Classes/Interfaces**: PascalCase (`EventBus`, `IRepository`)
- **Functions/variables**: camelCase (`handleEvent`, `totalCount`)
- **Constants/enums**: PascalCase for enums, SCREAMING_SNAKE_CASE for static (`UserRole`, `MAX_RETRIES`)
- **Files**: PascalCase.ts (`EventBus.ts`)

## ANTI-PATTERNS (FORBIDDEN)

1. **Type suppression**: Never use `as any`, `@ts-ignore`, `@ts-expect-error`
2. **Empty catches**: `catch(e) {}` is forbidden - always handle or rethrow
3. **Test deletion**: Never delete failing tests to make build pass
4. **Direct imports**: Never import from other packages' src/ - use published packages only
5. **Breaking changes**: Never make breaking changes without major version bump

## UNIQUE STYLES

### Error Handling
Use **RFC 7807 ProblemDetails** via `@croco/problems-core`. All errors extend `Problem` abstract class with category metadata. Automatic HTTP status mapping based on `ProblemCategory`.

### Context Management
**AsyncLocalStorage** for request scoping (no thread-local storage). DI container uses **TypeDI** with request-scoped services. Context must be initialized via `Context.withRequest()`.

### Event Architecture
**Domain Events**: Extend `DomainEvent`, use `AggregateRoot.addDomainEvent()`. Handlers: Use `@RegisterEventHandler(EventClass)` decorator. Async publishing: All event handlers are async.

## COMMANDS

### Development
```bash
pnpm install
pnpm --filter @croco/events-core build
pnpm --filter @croco/framework-context lint
pnpm build          # Build all packages in dependency order
pnpm test           # Run all tests (Vitest)
pnpm lint           # ESLint all packages
pnpm typecheck      # TypeScript check all packages
```

### Single Test Execution
```bash
npx vitest run packages/{package-name}/src/{path}.test.ts
npx vitest packages/{package-name}/src/{path}.test.ts  # watch mode
pnpm --filter @croco/{package-name} test

# gid-core special commands
pnpm --filter @croco/gid-core test         # vitest run
pnpm --filter @croco/gid-core test:watch   # vitest (watch)
```

### Deployment
```bash
pnpm --filter @croco/events-core deploy
pnpm deploy --otp <code>
```

## VITEST CONFIG

- **Framework**: Vitest v4.0.16 with coverage (@vitest/coverage-v8)
- **Environment**: Node.js
- **Globals**: true (describe/it/expect without import)
- **Timeout**: 10 seconds
- **Excludes**: packages/utils-*, node_modules, dist
- **Files**: `*.test.ts` or `*.spec.ts` in any `src/` directory
- **Structure**: Library-focused (consumers test usage, not internal implementation)

## GIT HOOKS

- **Pre-commit**: Auto-fix ESLint on .ts/.tsx/.jsx/.js/.mdx/.json files
- **Pre-push**: Run test and typecheck
- **Post-merge**: Auto-run `pnpm install`

## DEPLOYMENT STRATEGY

- **AWS Lambda optimized**: Fast startup, minimal dependencies
- **API Gateway v2**: Native HTTP API support
- **Dual format**: ESM + CJS for maximum compatibility
- **Zero config**: All packages publish-ready with standard scripts

## NOTES

- **Korean docs**: Primary documentation in Korean, English secondary
- **DDD patterns**: Domain-driven design throughout
- **Serverless-first**: Lambda deployment strategy, not traditional hosting
- **Opinionated**: Strong architectural opinions, not a generic library collection
