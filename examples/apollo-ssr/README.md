# Apollo request-owned SSR

A buffered Node SSR → browser path using Apollo Client **4.3.3**, React **19.2.6**, real GraphQL HTTP
and the common Croco `GraphQLAuthGuard`. No Croco query hook or second cache is involved. This is a
loopback-only example with synthetic Alice/Bob sessions and process-local discounts, not production auth.

```sh
pnpm --filter @croco-example/apollo-ssr... build
pnpm --filter @croco-example/apollo-ssr typecheck
pnpm --filter @croco-example/apollo-ssr test
pnpm --filter @croco-example/apollo-ssr test:browser
pnpm --filter @croco-example/apollo-ssr serve
```

Open `http://127.0.0.1:4178`. Build runs `codegen:check` against `src/schema.graphql` and
`src/operations.graphql`. After an intentional schema/document change run the example's `pnpm codegen`.
GraphQL Codegen's TypeScript, operations and TypedDocumentNode plugins produce native documents and fragment
result types. `Money` has explicit string input/output mapping, strict unmapped-scalar rejection and GraphQL
nullability. Scalar serialization remains the API's responsibility; a type mapping does not convert values.
Invalid fields, variable declarations and stale generated documents fail the build. Invalid variable values and
result assumptions fail typecheck. `useQuery(ProductDetailDocument, { variables })`, `useFragment` and
`useMutation(DiscountDocument)` infer these types directly.

## Ownership and freshness

`createApolloSession` belongs to one SSR request or browser identity generation and explicitly declares `ownership: "client" | "server"`. Pass the same returned
`client` to every `ApolloProvider`/query in that owner. The server creates a session per render and disposes it
in `finally`. The browser restores the native client-owned cache containing ProductDetail before `hydrateRoot`. Native
`cache-first` finds a complete query and adds no hydration fetch. There is no time-based freshness promise:
this example refreshes explicitly after mutation with `refetchQueries` and `awaitRefetchQueries`.

`Product:p1` is a native normalized entity. Its `quote(variant:)` field retains Apollo's default argument keys;
`member` and `standard` never overwrite each other. Different users/tenants/personalization scopes require
separate owners even with the same product id. Context/header changes do not partition a normalized cache.
For pagination, pass native `typePolicies` through `cache`; the integration does not replace `keyArgs` or merge
functions. Native `errorPolicy` remains per operation. HTTP 200 is not query success: partial errors, null
bubbling and business Problems stay visible as Apollo errors. Mutation UI reports errors separately.

Before login/logout, tenant or personalization transitions, dispose the old session, remove its mounted
provider and install a fresh session/provider key, even if transitioning back to a previously used tenant.
Do not reuse an owner or old hydration. Disposal aborts HTTP, stops observers and clears entities; a transport
that ignores cancellation is fenced before its response reaches Apollo. A failed transition leaves the UI
unavailable rather than reusing a disposed cache. Server-side authorization still decides every operation.
This sample's buttons change only their synthetic HttpOnly user/tenant cookies; wire a real auth provider before deployment.

## Hydration and trust

`session.extract()` uses native `InMemoryCache.extract()` without replaying queries or field policies.
Only `ownership: "client"` sessions can export or restore hydration. Every operation written to that cache
must be browser-owned. Server-only operations use a separate `ownership: "server"` session that cannot be
hydrated; the example's server-only query is disposed before rendering the client tree. No result is copied
between those owners, and no parallel Croco cache is created. This separation preserves custom `read` policies,
`keyArgs`, pagination merge functions and raw normalized entities without applying transformations twice.
It is an **application ownership contract**, not automatic secret detection: never query server-only fields,
token-bearing scalars or secrets through a client-owned session. Any observed GraphQL or transport error makes
the session ineligible for successful hydration, even when native `errorPolicy: all` retains partial data.
Render an explicit error state or start a fresh owner after recovery; cache snapshots cannot preserve operation errors.
Only finite plain JSON is accepted; instances, cycles, accessors and prototype keys are refused. JSON is HTML
escaped and inserted into an `application/json` text node, then restored with an exact, non-secret owner id.
Treat the document as trusted same-origin server output and retain normal CSP/XSS controls; the owner id is a
stale-state guard, not an authentication credential. Cache snapshots never contain request headers or clients.

Configure the absolute endpoint and allowed origins in trusted application configuration. Forward only explicitly
selected server credentials (this sample forwards `cookie`); never spread incoming request headers or derive
an allowlist from `Host`/query parameters. The transport fixes the exact endpoint, prevents context from replacing
identity headers, sets redirect rejection and server credential omission, and refuses context URI overrides.
Browser cookie authentication is same-origin. An injected fetch must honor redirect rejection and AbortSignal.
No direct `SchemaLink` execution is used: SSR and browser traverse the same HTTP transport and field guards.

Queries and mutations use POST; per-operation URI and GET destination overrides are rejected.

No query telemetry is emitted by this integration. If adding telemetry, record the original operation name and
an approved correlation id only; omit variables, raw query text, credentials and result payloads by default.
Query/mutation observation does not establish purchase success or experiment exposure.

## Boundaries and evidence

`prerenderStatic` with `renderToString` buffers a complete `useQuery` tree. It does **not** support Suspense,
`@defer`, incremental delivery or subscriptions here, and no streaming claim is made. This example is not a
Next.js adapter and copies no integration internals. Existing meta-vite SSR/RSC remains independent. A future
Flight path must choose server versus client ownership explicitly: RSC-only reads stay server-owned and must
not run in a client-owned Apollo session. Client revalidation updates Apollo UI only; it cannot refresh an
RSC snapshot. Refresh the RSC route separately when both surfaces must change. No RSC integration is verified.

Kubernetes/Node: local Node production artifact and browser evidence only; cluster deployment is unverified.
AWS Lambda: no invocation adapter, lifecycle or deployment evidence; unverified.
Cloudflare: no Workers integration or execution evidence; unverified. This Node server is not a Worker.
No infrastructure provisioning, live credentials, certification, npm publishing or new cache engine is included.

The browser checker starts the actual Vite production build on an ephemeral loopback port, checks desktop/mobile
hydration without a duplicate request, native fragment/mutation updates, identity transition with an old held
response, errors and overflow. Screenshots go to `$APOLLO_EVIDENCE_DIR` or the OS temporary directory.

References: [Apollo manual SSR](https://www.apollographql.com/docs/react/performance/server-side-rendering),
[TypedDocumentNode plugin](https://the-guild.dev/graphql/codegen/plugins/typescript/typed-document-node).
