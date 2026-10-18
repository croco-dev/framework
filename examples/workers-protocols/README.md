# Workers GraphQL and tRPC conformance

This local fixture runs GraphQL Yoga and the official tRPC fetch adapter through
`createCloudflareWorkersHost` in real workerd, using Miniflare. It uses synthetic
credentials (`Bearer tenant-a` / `Bearer tenant-b`), no account or external provider.
It is not production authentication or full SaaS profile certification.

```sh
pnpm install --frozen-lockfile
pnpm --filter @croco-example/workers-protocols build
pnpm --filter @croco-example/workers-protocols test
pnpm --filter @croco-example/workers-protocols codegen:check
```

`src/schema.graphql` and `src/operations.graphql` feed the official GraphQL Code
Generator generic SDK. `pnpm --filter @croco-example/workers-protocols codegen`
regenerates the checked-in client. The same schema, resolvers and GraphQL error oracle
run through the Node fetch handler and workerd. tRPC uses its native client proxy and
existing decorated controller route contracts, validation and execution pipeline.
No domain calculation is reimplemented per runtime.

The build bundles only the fetch entrypoints and rejects filesystem/HTTP listener
imports. Croco's AsyncLocalStorage scopes require Workers `nodejs_compat`;
`node:async_hooks` and `node:crypto` are the only permitted Node imports. The API returns
GraphQL partial data/errors and tRPC envelopes independently, preserves multiple cookies,
and isolates tenant state during overlapping requests. A local Miniflare outbound
rendezvous holds all four tenant/protocol requests until they have arrived; it uses no
external service or timers. The abort fixture creates an
already-aborted Request inside workerd and proves the host signal reaches the tRPC
procedure; it does not establish propagation of a network client disconnect.

GraphQL subscription schemas fail with
`transports-graphql/fetch-subscriptions-unsupported`. tRPC subscription/streaming,
WebSocket upgrades, incremental delivery, remote side-effect cancellation and live
Cloudflare deployment are outside the verified claim. The prepared GraphQL schema must
already carry any selected guard/operation semantics; the fetch transport does not
compile decorators or discover/register components. Host applications own authentication,
body admission, deadlines and production policy.
