# Zod 4 schema contracts

Croco route contracts, operations, OpenAPI/RPC generation, contract testing and generated
applications use Zod **4.6.6 or later in major 4**. Import from `zod`. Zod 3 schemas, including
`zod/v3` inside a Zod 4 distribution, are rejected at contract collection with
`contract-schema-unsupported-zod-major`. Updating the package while retaining `/v3` does
not apply the constrained-collection security fix (GHSA-mrhx-c7xc-m3w5).

## Application migration

Update every application schema dependency to the supported major together with Croco
packages. OpenAPI integrations use `@asteasolutions/zod-to-openapi` 8.5.0.
Regenerate and review contract snapshots, OpenAPI documents, RPC clients and project maps
with the application's existing scripts before accepting any baseline changes.

- Replace `z.record(valueSchema)` with `z.record(z.string(), valueSchema)`.
- Replace `z.AnyZodObject` with `z.ZodObject`. Refinements remain on their original schema;
  transforms and preprocessing use Zod 4 pipes. Route `params` and `query` must retain an
  object input and an object output. Scalar-input or scalar-output pipes are rejected.
- Coerced schemas have `unknown` input by default. When piping a known string object to
  a coerced number, declare `z.coerce.number<string>()` so the pipe's input types agree.
- `z.number().int()` and `z.int()` accept safe integers only. Contract descriptors retain
  `Number.MIN_SAFE_INTEGER` and `Number.MAX_SAFE_INTEGER` bounds, including when comparing
  historical snapshots. Do not accept an incompatible snapshot automatically.
- Zod 4 catch schemas retain their inner input type. For example, the client input of
  `z.string().catch('fallback')` is a string; runtime fallback still handles invalid input.
- Defaults inside optional object fields now run even when the field is omitted. Review
  `z.string().default(value).optional()` and equivalent wrapped defaults for changed output.
- Default values represent parsed output. Supply a complete output default, including nested
  fields; a partial input default such as `{}` no longer runs the inner defaults.
- Inspect `error.issues`; Zod 4 validation messages differ from Zod 3. Croco keeps request
  issue paths and Problem codes, while forwarding the current validator's message.

The existing JSON-safe schema support matrix remains authoritative. Custom refinements
retain runtime execution and normalize to an effects descriptor with a warning for generated
contracts. Value-changing pipes remain unsupported in generated JSON contracts. Type-only
brands add no runtime wrapper. Multi-value `z.literal([...])` is rejected explicitly; use a
union of single-value literals for generated contracts.

## Collection limits

Declare collection limits before value-changing checks. Zod 4.6.6 rejects oversized constrained
arrays, maps and sets before visiting entries, including async array refinements. A collection
without an upper bound has no size limit to enforce. Request transport/body limits remain
owned by the selected transport and application policy.

Schema inspection and query projection preserve lazy default getters without evaluating them.
Removing a parameter catch fallback retains its refinement checks. Cross-module Zod 4 schemas
are recognized by their versioned structure rather than their constructor name.
