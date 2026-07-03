# Static Misuse Checks

`pnpm static-misuse:check` runs repository-local static misuse detectors before the normal lint
and format pass. Current rules:

- `CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY`
- `CROCO_STATIC_REST_GENERATED_CONTRACT_SCHEMA_BOUNDARY`
- `CROCO_STATIC_RAW_ERROR_RUNTIME_BOUNDARY`
- `CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY`

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

## Generated REST Contract Rule

Generated app templates under `packages/create-croco-app/templates` are contract-first surfaces.
They must use explicit HTTP method decorators and schema-backed body and named parameter decorators.
The same policy is also exported as
`@croco/oxlint-rules/rest-generated-contract-schema` and enabled for generated template
controllers in `.oxlintrc.json`.

The rule fails on:

- `@All(...)`
- `@Body()` without a schema argument
- `@Param("name")`, `@Query("name")`, or `@Header("name")` without a schema argument

Generated templates should instead pass the route contract schema:

```typescript no-check
@Post("/:id")
@ResponseSchema(userSchema)
create(
  @Param("id", userIdSchema) id: string,
  @Body(createUserInputSchema) input: CreateUserInput,
) {
  return users.create(id, input);
}
```

Compatibility-mode application code can still use loose decorators outside generated templates. Those
paths remain covered by ContractGraph, RPC codegen, and OpenAPI diagnostics when generated contracts
are emitted.

## Runtime Failure Evidence Rules

Production package source under `packages/*/src` is checked for runtime failure boundaries that hide
failure evidence:

- `CROCO_STATIC_RAW_ERROR_RUNTIME_BOUNDARY` flags raw built-in `Error` throws. Runtime package
  failures should use Croco `Problem` subclasses or diagnostic-coded package errors.
- `CROCO_STATIC_EMPTY_CATCH_RUNTIME_BOUNDARY` flags empty `catch` blocks, including catches whose
  body only contains comments. Runtime package catches should either handle the failure explicitly or
  preserve a reviewed reason for intentionally best-effort recovery.

Reviewed exceptions use structured JSON baselines instead of ad hoc inline comments:

- `scripts/static-misuse-raw-error-allowlist.json`
- `scripts/static-misuse-empty-catch-allowlist.json`

Each baseline entry must include the package name, source file, line, excerpt, reason, and either
`owner` or `expiresOn`. The checker validates that the package matches the source package and that
the excerpt still matches the current line, so stale exceptions fail the gate.

Example empty-catch entry:

```json
{
  "package": "@croco/transports-http",
  "file": "packages/transports-http/src/libs/PipelineRunner.ts",
  "line": 213,
  "excerpt": "} catch {",
  "reason": "Exception filter failure intentionally falls through to the next filter or default error handler.",
  "owner": "framework-error-handling"
}
```

Inline `croco-static-misuse-ignore-line` and `croco-static-misuse-ignore-next-line` comments remain
available for line-oriented false positives, but they do not suppress the empty-catch rule. Add a
structured baseline entry or make the catch handle the failure directly.
