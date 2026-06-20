# Static Misuse Checks

`pnpm static-misuse:check` runs repository-local static misuse detectors before the normal lint
and format pass. Current rules:

- `CROCO_STATIC_REPOSITORY_CORE_IMPLEMENTATION_BOUNDARY`
- `CROCO_STATIC_REST_GENERATED_CONTRACT_SCHEMA_BOUNDARY`

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
