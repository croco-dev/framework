# Warehouse explorer

A zero-credential local example using a temporary Docker PostgreSQL resource and the real
`@croco/warehouse-postgres/facts` catalog, writer, seal, publish, and reader APIs.

From the repository root, with Docker running:

```sh
pnpm install
pnpm --filter @croco/warehouse-core build
pnpm --filter @croco/warehouse-postgres build
pnpm --filter @croco/admin-react build
pnpm --filter @croco-example/warehouse-explorer dev
```

Open <http://127.0.0.1:4320>. The capture dataset preserves a 64-bit money amount as a string;
`/?dataset=search` exposes a dated search aggregate with exact decimal values. Each dataset has
one published snapshot, an explicitly failed import candidate, and a sealed replacement candidate.
The explorer can publish that replacement or remove the current publication using a reason,
idempotency key, and expected revision. Reload after an operation to read the new publication.
The server resolves its synthetic operator identity and access scope; submitted actors cannot change it.

`/?dataset=empty`, `/?dataset=denied`, and `/?dataset=unavailable` are explicitly synthetic
presentation fixtures. They do not simulate PostgreSQL outages or change authorization policy.
The example is bound to loopback and is not a production authentication implementation.

Run `pnpm --filter @croco-example/warehouse-explorer smoke` for a real PostgreSQL publication
smoke check, or `pnpm --filter @croco-example/warehouse-explorer build` to typecheck.
Stop the server with SIGINT/SIGTERM to dispose its temporary resource.
