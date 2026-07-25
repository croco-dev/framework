# Static Misuse Checks

`pnpm static-misuse:check` runs repository-local static misuse detectors before the normal lint
and format pass. Current rules:

- `CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY`
- `CROCO_STATIC_REST_GENERATED_CONTRACT_SCHEMA_BOUNDARY`
- `REST_DECORATOR_CONTRACT_MISMATCH`
- `REST_CONTRACT_BINDING_WITHOUT_ROUTE`
- `REST_DUPLICATE_PARAMETER_BINDING`
- `REST_RESPONSE_SCHEMA_CONFLICT`
- `REST_MULTIPLE_ROUTE_DECORATORS`
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

## REST Decorator Contract Graph Rule

Controller methods must use one coherent, statically resolvable route contract across their HTTP
method, `@Param`, `@Query`, `@Body`, and `@ResponseSchema` decorators. The checker reports stable
diagnostics when it proves any of the following:

- a parameter decorator references a different contract from the HTTP method decorator;
- a contract-bound parameter is attached to a loose or missing route decorator;
- the same request source and key is bound more than once;
- `@ResponseSchema` conflicts with the route contract response;
- a method has multiple HTTP method decorators.

Contract identity follows local `const` declarations, relative named imports, import aliases, and
named or star re-exports, including TypeScript sources referenced through ESM `.js` specifiers.
Decorator order does not affect the result, and an overriding controller method is checked together
with matching inherited decorator metadata. Header binding keys are compared case-insensitively. A
dynamically produced contract or schema that cannot be resolved to an explicit declaration is
deliberately left unclassified: the checker emits no advisory or error rather than guessing. Use an
explicit exported route contract to enable deterministic relationship validation.

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
  "file": "packages/transports-http/src/libs/CrocoRouteRegistrar.ts",
  "line": 594,
  "excerpt": "} catch {",
  "reason": "Dev inspector warning logging is best-effort and must not affect request handling.",
  "owner": "framework-error-handling"
}
```

Inline `croco-static-misuse-ignore-line` and `croco-static-misuse-ignore-next-line` comments remain
available for line-oriented false positives, but they do not suppress the empty-catch rule. Add a
structured baseline entry or make the catch handle the failure directly.
