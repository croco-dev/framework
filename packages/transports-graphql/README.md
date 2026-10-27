# @croco/transports-graphql

GraphQL schema compilation and server transport for Croco.

`@croco/transports-graphql` compiles code-first GraphQL resolver metadata into an
executable schema and serves it through GraphQL Yoga. It keeps the server runtime
separate from protocol-level resolver contracts.

## Public API

- `SchemaCompiler` - builds GraphQL schemas from resolver metadata.
- `GraphQLServer` - initializes and serves the GraphQL Yoga runtime.
- GraphQL transport Problems for missing schema, missing resolvers, initialization, and
  request-body failures.
- Server and schema compilation option types.

## Usage

```typescript
import { GraphQLServer, SchemaCompiler } from "@croco/transports-graphql";

const schema = await new SchemaCompiler().compile({ resolvers: [HealthResolver] });
const server = new GraphQLServer({ schema });
```

`maxBodySizeBytes` defaults to 1 MiB and must be a finite positive safe integer. The
server validates this option during initialization, before opening its listener, and
rejects invalid values with `transports-graphql/body-limit-invalid-configuration`.
Declared `Content-Length` values and actual streamed bytes use an inclusive boundary:
a request with exactly the configured number of bytes is accepted, while a request that
exceeds an otherwise valid limit is rejected with `transports-graphql/request-body-too-large`.

`requestTimeoutMs` optionally bounds the lifetime of Node-hosted requests created by
`GraphQLServer.start()`. It must be an integer from 1 through 2,147,483,647 and is validated
when the server is constructed. When the deadline expires, the request signal is aborted,
GraphQL execution is cancelled, and the Node adapter returns an `application/problem+json`
response with status 500 and code `transports-graphql/request-timeout`. Client disconnects
abort the same request signal. Omitting the option preserves the existing unbounded deadline.

Schemas compiled through `SchemaCompiler` execute the `UseGuards`, `Roles`, and
`UseInterceptors` declarations recorded by `@croco/protocols-graphql`. Request
headers are available as `context.headers`, custom server context is preserved, and
declared policy providers are resolved from Croco `Container`. Guards and roles run
before a subscription acquires its async iterator; interceptors run for each resolved
subscription payload.

## Resolver dependencies

Compile a schema inside its owning `ApplicationRuntime.run()` after installing the
compiler-generated DI graph. The default schema container resolves registered resolvers
and their constructor dependencies through that application, including when execution
occurs later. Request-scoped resolvers require an active `Context.run()` for each request;
keep host callbacks bound to the application with `bindHostCallback()`. Disposing the
application makes retained schema resolution fail rather than creating new instances.

Explicit `container` objects and container getters retain TypeGraphQL semantics and
own their resolution and lifetime. Standalone manual resolvers (`autoDiscover: false`)
with no required constructor arguments remain supported and are cached per schema.
A resolver with required constructor arguments and no registered provider or custom
container fails compilation with `transports-graphql/resolver-container-required`.
JavaScript constructor arity does not identify default or rest parameters; use a generated
graph or explicit container whenever constructor dependencies are needed.

## Failure Semantics

Resolver and context failures that are Croco `Problem` instances are converted through
the GraphQL protocol serializer before Yoga returns the GraphQL `errors` envelope. The
transport applies the same code-first, category-fallback redaction policy as HTTP:
public and safe-message Problems retain safe detail and allowlisted extensions, while
operator-only Problems return an opaque message with no Problem extensions.

Wrapped `GraphQLError` values use the same conversion when `originalError` is a Croco
`Problem`, retaining the GraphQL resolver path. Non-Problem errors continue through
Yoga's default masking behavior. User-provided Yoga plugins remain active. Runtime
errors do not expose `requestId`, `traceId`, telemetry, or `redactionPolicy` fields.
Yoga's server-side logger applies the same redaction to Croco Problems. Operators still
need deployment-specific secret handling for non-Problem failures.

## Verification

```bash
pnpm --filter @croco/transports-graphql test
pnpm --filter @croco/transports-graphql typecheck
```

## Workers fetch transport

Use `createGraphQLFetchHandler` from `@croco/transports-graphql/fetch` with a prepared
`GraphQLSchema` and `createCloudflareWorkersHost` from `@croco/preset-cloudflare/fetch`.
The fetch entrypoint avoids Node HTTP listeners and the filesystem-based code-first
compiler. Runtime guards and Problem conversion are available through
`@croco/protocols-graphql/fetch`. Existing Node server/schema compilation APIs remain on
the root entrypoint.

Workers requires `nodejs_compat` for Croco request scopes. Queries and mutations use
Yoga's native Request/Response path, preserving content negotiation, partial data,
Problem masking and response headers. The fetch-only entrypoint disables GraphiQL and
the landing page. It rejects a schema containing subscription fields with
`transports-graphql/fetch-subscriptions-unsupported`; subscription delivery, WebSockets,
incremental streaming and deployment certification are outside this support claim.
Node listener body limits and timers apply only to `GraphQLServer.start()`. Fetch hosts
own body admission and deadlines. Request abort signals reach Yoga; remote side effects
are not rolled back by cancelling a request.

See [Workers protocol conformance](../../examples/workers-protocols/README.md) for the
local workerd smoke, generated GraphQL SDK and native tRPC client evidence. This does
not certify a deployed Worker or the full SaaS Cloudflare profile.
