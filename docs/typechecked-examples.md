# Typechecked Documentation Examples

Croco documentation examples are part of the framework contract. Any TypeScript that a user or an
LLM might copy must either be type-checked against the current workspace packages or be explicitly
marked as non-executable example text.

## Scope

`pnpm docs:examples:check` scans authored Markdown and MDX documentation in these areas:

- `README.md`
- `docs/**/*.md`
- `packages/docs/src/content/docs/en/guides/**/*.{md,mdx}`
- `packages/docs/src/content/docs/en/reference/**/*.{md,mdx}`
- `packages/docs/src/content/docs/ko/**/*.{md,mdx}`

The check runs inside `pnpm check`, and CI runs `pnpm check` in the `Lint & Format Check` step. A
broken checked example therefore fails the same gate as lint, format, package manifest, catalog, and
public API drift.

## Fence Modes

Authored TypeScript examples use one of two explicit modes:

- `typecheck` fences are extracted and checked against workspace package public APIs.
- `no-check` fences are intentionally skipped because they are pseudo-code, partial code, or depend on runtime-only symbols.

Use `typecheck` by default for complete examples in README quick starts, guide workflows, reference
snippets, and any code that demonstrates public `@croco/*` package APIs. A checked fence must be
self-contained: import the public packages it uses, declare local sample values or types it needs,
and avoid private source paths.

Use `no-check` only when the snippet is intentionally not valid standalone TypeScript. Common cases
are abbreviated pseudo-code, generated code fragments, environment-owned symbols such as an existing
`app`, `runtime`, or controller instance, and examples that are valid only after an external build
step has produced files outside the docs checker.

Untyped TypeScript fences are not allowed for new documentation. Existing unmarked legacy blocks are
tracked in `docs/doc-examples-baseline.json` with a reason so drift is visible. Do not add new
baseline entries for new docs; either make the fence `typecheck` or mark it `no-check`.

## Authoring Workflow

1. Write complete copyable TypeScript as `typescript typecheck`.
2. Mark intentional pseudo-code as `typescript no-check` and explain the missing runtime context in
   the surrounding prose when it is not obvious.
3. Run `pnpm docs:examples:check` before opening a documentation PR.
4. If an existing legacy block is converted to `typecheck` or `no-check`, run
   `pnpm docs:examples:write` to remove its stale baseline entry, then rerun
   `pnpm docs:examples:check`.
5. Treat a typecheck failure as API or documentation drift. Fix the example or the exported package
   contract instead of weakening the fence mode.

## Checked Example

```typescript typecheck
import { HttpStatus, ProblemCategory, ProblemFactory } from "@croco/problems-core";
import type { ProblemDetails } from "@croco/problems-core";

const problem = ProblemFactory.notFound("USER_NOT_FOUND", "User was not found");

const details: ProblemDetails = {
  type: problem.type,
  title: problem.title,
  status: HttpStatus.NOT_FOUND,
  detail: problem.detail,
  code: problem.code,
};

const category: ProblemCategory = problem.category;

void details;
void category;
```

## Intentional Pseudo-code Example

```typescript no-check
@Controller("/runtime-owned")
class RuntimeProvidedController {
  @Get(":id")
  show() {
    return runtime.lookupCurrentTenant();
  }
}
```
