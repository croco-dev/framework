# Static Misuse Checks

`pnpm static-misuse:check` runs repository-local static misuse detectors before the normal lint
and format pass. The first rule is
`CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY`.

## Repository Boundary Rule

`@croco/repository-core` is the interface layer for repository contracts. Source files under
`packages/repository-core/src` must not import Drizzle ORM or `@croco/tx-drizzle`; Drizzle-backed
repository implementations belong in `@croco/tx-drizzle`.

When the rule fails, the diagnostic includes:

- stable diagnostic code,
- file, line, and column,
- the offending source line,
- the recovery action.

Example:

```text
packages/repository-core/src/index.ts:1:1: CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY
action: Move Drizzle ORM integration code to @croco/tx-drizzle.
```

## Limitation And Escape Hatch

This first pass is import-oriented. It detects direct implementation imports in source files; it does
not prove that every indirect type alias or generated artifact is adapter-neutral.

For a reviewed false positive, suppress exactly one line and explain why:

```typescript no-check
// croco-static-misuse-ignore-next-line CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY -- explain the reviewed exception
import type { Something } from "drizzle-orm";
```

Prefer moving the implementation dependency to the owning package over suppressing the diagnostic.
