# Contract-first gates

Croco REST controllers can be validated before generating OpenAPI documents or RPC clients. Use the
contract graph commands as the release gate for generated artifacts.

## Recommended flow

For an intentional contract change, refresh the committed baseline:

```bash
pnpm contract:check
pnpm contract:snapshot
```

`contract:check` validates controller metadata and fails on contract graph errors such as missing
path params, duplicate operation ids, multiple request bodies, or, in generated app strict mode,
missing response, body, path, query, or header schemas.

`contract:snapshot` writes a deterministic `contract-graph.snapshot.json` file. Commit this file
when a contract change is intentional.

For CI and release verification, do not run `contract:snapshot` before the drift check:

```bash
pnpm contract:verify
```

Generated `create-croco-app` REST templates expose `contract:verify` and `ci:contracts` scripts.
They run REST graph checks with `--strict-schemas`, compare the committed snapshot against current
controllers first, write a consumer coverage report, then regenerate OpenAPI and RPC client
artifacts from the accepted contract.

`contract:diff` compares the committed snapshot with current controllers and fails on current graph
errors or breaking contract drift. Removed controllers, removed routes, HTTP method/path changes,
removed operation ids, required request-field additions, incompatible request schema changes, and
incompatible response schema changes are breaking. Additive routes and optional request fields are
reported as non-breaking.

`contract:openapi` and `contract:client` should run after the check and diff gates so generated
artifacts are produced only from an accepted contract graph.
Generated REST app templates run schema-strict ContractGraph validation for both generators and pass
`--fail-on-diagnostics` so schema-less routes or missing generated-client Problem contracts fail
before OpenAPI output or permissive `unknown | undefined` RPC success types are written.
`croco-openapi-spec` and `croco-rpc-codegen` default to strict schema mode and strict Problem
contract diagnostics; use `--compatibility-schemas` or `--compatibility-problems` only as explicit
migration opt-outs for legacy routes that are not part of the generated 1.0 app path.

`contract:coverage` writes `contract-graph.coverage.json` with the same route graph plus consumer
coverage diagnostics. Unsupported graph fields are reported explicitly so generator omissions do not
look like successful consumption.

The committed baseline is `contract-graph.snapshot.json`. `contract-graph.coverage.json`,
`openapi.json`, and generated RPC client files may be committed when consumers need checked-in
artifacts, but CI should regenerate them from the server controllers rather than treating
hand-edited generated output as authoritative.

## GraphQL SDL snapshots

Generated GraphQL apps use a sibling contract gate, not the REST ContractGraph. The authoritative
artifact is the package-local `graphql-contract.snapshot.json`, which stores the compiled SDL plus
Croco resolver metadata such as DI scope, guards, roles, interceptors, and declared Problem mappings.

Standalone GraphQL generated apps run the gate from `apps/graphql-api`; Next.js GraphQL generated
apps run it from `apps/web`. CI and generated smoke should run the check before refreshing the
snapshot:

```bash
pnpm --dir apps/graphql-api contract:check
pnpm --dir apps/graphql-api contract:snapshot
```

Use `apps/web` for the Next.js GraphQL path. `contract:check` compares the committed
`graphql-contract.snapshot.json` with the current compiled schema and fails on unreviewed breaking
SDL drift, removed operations, resolver removal, DI-scope changes, guard/interceptor/role changes,
and Problem mapping changes. `contract:snapshot` is only for intentional GraphQL contract changes
after review.

Do not route GraphQL apps through REST `contract-graph.snapshot.json`, OpenAPI, or RPC codegen gates.
Those gates still own REST controller contracts; GraphQL review stays centered on compiled SDL plus
resolver metadata.

## Typed RPC clients

`contract:client` reads the same REST controller metadata and writes a fetch client with generated
request and response types. A controller route such as `GET /users/:id` with `@Param("id",
z.string())`, `@Body(z.object(...))`, and `@ResponseSchema(...)` becomes a generated client method
whose path params, body, and successful response are checked by TypeScript.

Generated clients do not import Zod or validate successful responses again at runtime. If
`@croco/rpc-codegen` cannot represent a Zod schema as a JSON-safe TypeScript type, generation fails
instead of widening the contract to an implicit fallback type. RFC 7807 responses are represented as
`RpcClientProblemError` rejections with `RpcProblemDetails`, so Problem responses are not returned as
successful response values.

## JSON-safe Zod support matrix

ContractGraph snapshots, OpenAPI generation, and RPC codegen share the
`JSON_SAFE_ZOD_SCHEMA_SUPPORT_MATRIX` exported by `@croco/protocols-core`. Unsupported schemas fail
with `contract-schema-json-unsafe` before generator-specific output is written.

HTTP `HEAD` compatibility is a runtime transport policy, not a synthetic contract artifact. A
GET-only route may answer `HEAD` requests at runtime with the GET status/headers and an empty body,
but ContractGraph and OpenAPI still emit only the declared `GET` route. Declare `@Head()` when a
first-class ContractGraph `HEAD` route or OpenAPI `head` operation is required; same-path `GET` and
explicit `HEAD` declarations are method-distinct.

| Zod schema                                                                                                                                                       | Contract behavior                                                                                                     |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `ZodString`, `ZodNumber`, `ZodBoolean`, `ZodNull`                                                                                                                | Supported as JSON primitives.                                                                                         |
| `ZodLiteral`, `ZodEnum`, `ZodNativeEnum`                                                                                                                         | Supported for string, number, boolean, and null values.                                                               |
| `ZodObject`, `ZodArray`, `ZodRecord`, `ZodUnion`, `ZodDiscriminatedUnion`                                                                                        | Supported when nested schemas are JSON-safe.                                                                          |
| `ZodOptional`, `ZodNullable`, `ZodDefault`, `ZodBranded`, `ZodReadonly`                                                                                          | Supported through the shared inner-schema descriptor.                                                                 |
| `ZodEffects` refinements                                                                                                                                         | Supported through the inner schema with `contract-schema-zod-effects-unwrapped` warning.                              |
| `ZodEffects` transforms/preprocessors, `ZodDate`, `ZodBigInt`, `ZodFunction`, `ZodMap`, `ZodSet`, `ZodPromise`, `ZodSymbol`, `ZodNaN`, `ZodVoid`, `ZodUndefined` | Unsupported; use a JSON boundary schema such as an ISO string, plain object, array, or omitted empty response schema. |

## Direct CLI usage

```bash
croco contracts check --controllers 'apps/api-server/src/controllers/**/*.ts'
croco contracts check --controllers 'apps/api-server/src/controllers/**/*.ts' --strict-schemas
croco contracts check --controllers 'apps/api-server/src/controllers/**/*.ts' --json --out contract-graph.snapshot.json
croco contracts check --controllers 'apps/api-server/src/controllers/**/*.ts' --json --out contract-graph.coverage.json
croco contracts diff --baseline contract-graph.snapshot.json --controllers 'apps/api-server/src/controllers/**/*.ts' --strict-schemas
croco-openapi-spec --controllers 'apps/api-server/src/controllers/**/*.ts' --out openapi.json
croco-rpc-codegen --controllers 'apps/api-server/src/controllers/**/*.ts' --out libs/shared/provider-rpc/src
```

`croco contracts check --json` prints the same stable JSON snapshot to stdout when `--out` is not
provided. `croco contracts diff --json` prints a machine-readable diff report and exits non-zero
when breaking changes exist.

For legacy migration only, `croco-openapi-spec --compatibility-schemas` and
`croco-rpc-codegen --compatibility-schemas` keep the old schema-less generator behavior available.
`--compatibility-problems` similarly keeps missing generated client Problem unions out of the
strict diagnostic report. `--fail-on-diagnostics` is the generated-app gate that treats warnings and
errors as blocking before writing OpenAPI or RPC output. Do not use compatibility opt-outs in
generated app CI or 1.0 release evidence.
