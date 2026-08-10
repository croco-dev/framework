# TypeScript 6 legacy decorator signature feasibility

Issue #1510 evaluated whether Croco can bind legacy REST decorators to the annotated method signature without a
compiler transform or a runtime metadata change. The answer is yes for public, non-static, non-generic,
non-overloaded instance methods. The prototype is intentionally confined to
`scripts/fixtures/decorator-signature-spike`; it does not change a runtime package or a public export.

Run `pnpm decorator-signature-spike:check` to compile the positive and negative fixtures, compare representative
diagnostics, snapshot declaration emit, install and consume a packed prototype package, exercise its ESM and CJS
entrypoints, and compare the strict signatures with the current broad decorator types.

## Assignability policy

| Boundary           | Required relation                                                            | Consequences                                                                                                                                                                  |
| ------------------ | ---------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Contract parameter | `z.output<Schema>` must be assignable to the annotated parameter             | A parsed `UserId` may be delivered to `UserId`, `string`, or `unknown`, but not `number` or an unrelated brand. A wider runtime-safe annotation such as `string` is accepted. |
| Contract response  | The awaited annotated return must be assignable to `z.input<ResponseSchema>` | Sync and async methods use the same handler-return slot. A response transform accepts its pre-transform input from the handler and exposes its output only after parsing.     |

The checks are non-distributive over unions: the complete parsed parameter union must fit the annotation, and the
complete annotated return union must fit the handler-return slot. Optional and nullable members therefore cannot be
dropped. Defaults, coercions, transforms, and preprocessors use parsed output for parameters. Response transforms
use schema input for handler returns.

Brands follow the direction of each boundary. A branded request output is safe to pass to an unbranded base-type
parameter, so `UserId` to `string` is accepted. A branded response schema has an unbranded `z.input` unless the
schema explicitly requires a branded input, so a controller may return the input value accepted by that schema.

`any` is never accepted as the decorated method or parameter annotation because it would silently disable the
strict path. An unconstrained `z.any()` parameter output may only be delivered to `unknown`. `unknown` method
returns are accepted only when the response handler slot itself accepts `unknown`. Parameter annotations of
`never` are rejected for inhabited outputs; `z.never()` output is vacuously safe because parsing cannot produce a
value. Method returns annotated as `never` or `void` are rejected instead of treating non-returning or hidden values
as successful response evidence.

## Compiler boundaries

- Generic methods are rejected because a type parameter may later be instantiated with a narrower, incompatible
  type.
- Overloaded methods are rejected because the legacy decorator context exposes the overload set rather than the
  implementation annotation. The decorated implementation cannot be proven independently.
- Static methods are rejected because Croco controller metadata belongs to instances. Protected and private methods
  are rejected because the structural target cannot prove them as public controller slots.
- Multiple method and parameter decorators compile in either source order. The strict decorator validates its own
  slot and does not change decorator evaluation order.
- A strict decorator validates only the declaration where it is applied. Return overrides remain covariant, but
  class method parameters are bivariant: `limitations.ts` proves that an undecorated override can narrow an inherited
  contract-bound parameter and still compile. Because Croco inherits route metadata, static analysis must reject the
  override unless it repeats the contract decorator and revalidates the actual annotation.

The representative compiler errors remain the native concise `TS1241` and `TS1239` decorator diagnostics. They
identify the actual method descriptor or parameter index but reduce the rejected constraint to `never`; they do not
name the Croco contract or recovery action. Stable, domain-specific diagnostics for overloads and cross-decorator
relationships must therefore remain in `static-misuse:check` rather than relying on compiler prose.

## Declaration and performance evidence

TypeScript 6 declaration emit retains the strict contract overloads, broad string compatibility overloads, and the
conditional helpers required by external consumers. `prototype.snapshot.d.ts` locks their order and shape. The
verification command builds a temporary package, packs it with pnpm, installs it into a clean consumer, and proves
that strict positive and negative calls cannot fall through to the broad overload while loose calls remain
compatible. It also verifies both ESM and CJS export conditions without changing Croco's runtime package output.

The comparison fixture applies one method and one parameter decorator to 80 methods. On TypeScript 6.0.3 the
reviewed run reported 579 broad-signature instantiations and 26,106 strict-signature instantiations, a delta of
25,527, while check time moved from 0.03 seconds to 0.09 seconds on the same run. The gate uses the deterministic
instantiation delta, capped at 250,000, instead of asserting wall-clock time.

## Recommendations

For #1514, use the handler-return helper established by #1512 (`z.input<ResponseSchema>`) as the expected type for
an internal `ContractMethodDecorator`. Keep string/path overloads broad. Apply the strict signature only to contracts
with a response schema; a response-less contract has no handler-return contract to prove. Reject annotation-side
`any`, `never`, and `void`, and reject generic, overloaded, static, protected, and private methods. Preserve the
existing runtime decorator implementation and return the stricter type only from the response-contract overload.

For #1517, retain the implemented direction: parsed `z.output` assignable to the annotated parameter. Replace local
schema inference with the shared handler-input helper from #1512 when that issue lands, without changing the
assignability rule. Keep the overloaded-parameter rule in `static-misuse:check`; it supplies a stable diagnostic and
recovery action where legacy decorator typing cannot inspect the implementation annotation. Add an inheritance rule
that rejects an override of an inherited contract-bound parameter method unless the override repeats the contract
decorators, forcing its actual annotation through the strict type. The contract-graph checker must continue to own
mixed contracts, duplicate bindings, inheritance resolution, and conflicting response declarations because one
decorator invocation cannot observe its siblings.
