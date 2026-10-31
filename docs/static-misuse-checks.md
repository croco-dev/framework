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
- `CROCO_STATIC_DIRECT_ERROR_SUBCLASS_BOUNDARY`
- `CROCO_STATIC_TEST_CLOCK_BOUNDARY`

## Controlled test clocks

Declare `// croco-test-clock: controlled` in the leading comments of a test or test-helper file when its fixture owns a
logical clock. The existing `pnpm static-misuse:check` gate checks that file without maintaining
a second test inventory. Its diagnostics use `CROCO_STATIC_TEST_CLOCK_BOUNDARY` and include the
offending constructor or ambient read, its source location, and a recovery action.

Create the clock once per fixture. Use the existing `fixedClock`/`TestClock` when scheduled work
must advance, or the service's existing explicit clock callback for a synchronous fixture. Bind
service construction inside the fixture so reader, permission variant and restart instances retain
the same clock. A separate fixture must create a separate clock. Do not replace global `Date` or
global timers to make domain expiry assertions deterministic.

The checker follows resolved constructor declarations, including aliased imports and re-exports.
It requires explicit values for zero-argument `clock`/`now` callbacks returning `Date` or `number`,
`clock` objects with a callable `now`, and callable `schedule`/`scheduler` dependencies. It checks
both positional parameters and immediate options properties. Omitted options, explicit `undefined`,
and values whose types still allow `undefined` fail. Date-valued inputs such as `{ now: Date }`
are data, so they are not treated as dependency injection seams.

Ambient `Date()`, `Date.now()` and `new Date()` in a controlled file fail, including reads inside
callbacks. Parsing a supplied timestamp and constructing a date from supplied milliseconds remain
valid. Fixed dates are allowed; the rule does not ban date literals or require every test to use
`TestKernel`.

A native event-loop, browser or provider lifecycle assertion may need real elapsed time. Exempt
only the immediately following expression with a reason at the boundary:

```typescript no-check
// croco-test-clock-real-time -- Measure native socket shutdown; business expiry uses the fixture clock.
const startedAt = Date.now();
```

Blank reasons and separated comments do not suppress a diagnostic. The ordinary static-misuse
ignore directives do not suppress this rule. A lifecycle exception must not make business TTL,
retention, lease or retry assertions depend on wall time.

This is an explicit fixture contract, not whole-program clock analysis. Files without the declaration
retain their existing behavior. The checker does not prove clock identity, inspect opaque factories
or imported callback bodies, infer arbitrary dependency names, or trace clocks through service
locators. Typecheck still owns incompatible dependency values; fixture tests own shared-clock
identity and scheduler behavior. Keep a bound factory and regression coverage at those boundaries.

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
- `@Body()` without a schema, including explicit `undefined` or `void` arguments
- Named `@Param`, `@Query`, or `@Header` calls without a schema, including explicit `undefined` or `void`
  schema arguments. Names may be quoted strings, templates without substitutions, or local `const`
  bindings initialized from those expressions (including constant aliases and TypeScript assertions).

This is a syntax-and-scope check, not a type-aware schema validator. It preserves schema expressions,
contract-object overloads and `@Query()` whole-object binding. Imported values, mutable bindings,
computed expressions and templates with substitutions are not resolved as names; type-aware contract
validation must check those inputs. A locally shadowed `undefined` binding is also left to type-aware
validation.

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

`CROCO_STATIC_DIRECT_ERROR_SUBCLASS_BOUNDARY` flags class declarations and expressions that directly
extend `Error`, `TypeError`, `RangeError`, `ReferenceError`, `SyntaxError`, `EvalError`, `URIError`, or
`AggregateError`, including multiline heritage and `globalThis.Error` forms. Extend an existing
`Problem` subclass so failures carry the shared stable code, category, and recovery metadata. Adding a
`code` field alone does not exempt a new direct subclass: diagnostic-carrying boundary errors require
an explicit reviewed exception.

This rule inspects syntax. It does not resolve aliases, shadowed built-in names, or dynamic heritage.
Comments and generated source strings (including the browser client errors emitted by `rpc-codegen`)
are not executable class declarations and are excluded. Existing browser client wrappers in
`frontend-problems`, internal aggregates, build-tool diagnostics, and the canonical `Problem` root are
source-pinned in the baseline; their migration is outside #2926.

Reviewed exceptions use structured JSON baselines instead of ad hoc inline comments:

- `scripts/static-misuse-raw-error-allowlist.json`
- `scripts/static-misuse-empty-catch-allowlist.json`
- `scripts/static-misuse-direct-error-subclass-allowlist.json`

Each baseline entry must include the package name, source file, line, excerpt, reason, `owner`, and a current
`expiresOn` date. The checker validates that the package matches the source package and that
the excerpt still matches the current line, so stale exceptions fail the gate.

Example empty-catch entry:

```json
{
  "package": "@croco/transports-http",
  "file": "packages/transports-http/src/libs/CrocoRouteRegistrar.ts",
  "line": 594,
  "excerpt": "} catch {",
  "reason": "Dev inspector warning logging is best-effort and must not affect request handling.",
  "owner": "framework-error-handling",
  "expiresOn": "2027-01-15"
}
```

Inline `croco-static-misuse-ignore-line` and `croco-static-misuse-ignore-next-line` comments remain
available for line-oriented false positives, but they do not suppress the empty-catch or direct Error subclass rules. Add a
structured baseline entry or make the catch handle the failure directly.
