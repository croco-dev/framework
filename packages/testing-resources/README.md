# @croco/testing-resources

`@croco/testing-resources` adds optional real PostgreSQL and Redis lifecycles to
`@croco/testing` `TestKernel`. Docker and Testcontainers stay out of
`@croco/testing`; applications install this package only when they need
commit-time, migration, or real-service evidence.

## Prerequisites

- Docker Desktop, Colima, or another Docker-compatible daemon must be running.
- The current user must be able to run `docker info`.
- The first run must be able to pull the default PostgreSQL and Redis images.
- CI needs Docker but no database, Redis, or cloud credentials.

```ts
import { Token } from "@croco/framework-context";
import { createTestKernel } from "@croco/testing";
import {
  postgresResource,
  redisResource,
  testResourceProvider,
  type PostgresTestConnection,
} from "@croco/testing-resources";
import { drizzle } from "drizzle-orm/node-postgres";

const DRIZZLE_DATABASE_TOKEN = new Token<ReturnType<typeof drizzle>>("database");
const POSTGRES_CONNECTION = new Token<PostgresTestConnection>("postgres.connection");

const postgres = postgresResource({
  migrations: "./drizzle",
  mode: "commit",
  provides: POSTGRES_CONNECTION,
  providers: [
    testResourceProvider(DRIZZLE_DATABASE_TOKEN, (connection) => drizzle(connection.pool)),
  ],
});
const redis = redisResource();

await using test = await createTestKernel({
  bootstrap: createCrocoApp,
  fidelity: "application",
  obligations: [{ kind: "outbox", resource: postgres }],
  resources: [postgres, redis],
});

const connection = test.resource(postgres);
console.log(connection.connectionString);
console.log(test.resourceEvidence);
```

## Database modes and isolation

- `rollback` opens one outer PostgreSQL transaction on a dedicated client.
  Direct Drizzle work through `connection.client` remains invisible to other
  sessions and is rolled back during disposal. Tests that must commit their own
  top-level transactions must use `commit`.
- `commit` allows real commits, after-commit hooks, deferred constraints,
  serialization behavior, and outbox relay evidence.
- `migration` starts from an empty database, applies sorted `.sql` files from
  `migrations`, and otherwise has commit semantics.

PostgreSQL uses a database name derived from the explicit worker identity.
Redis clients receive a prefix derived from worker and test identities. Separate
kernels therefore do not share schemas, keys, or mutable test data.

`after-commit`, `outbox`, `deferred-constraint`, and `serialization` obligations
fail before application bootstrap when their PostgreSQL resource is in
`rollback` mode. The kernel exposes resource mode, isolation, image, lifecycle
diagnostics, and retained container logs as structured `resourceEvidence`.

## Image update policy

Defaults are pinned to a tag and OCI digest:

- PostgreSQL 16.10 Alpine
- Redis 7.4.5 Alpine

Update a default only after inspecting the official image manifest, running the
real-resource suite on Linux, and reviewing upstream release notes. Overrides
must also use `image@sha256:...`. `allowUnpinnedImage: true` is reserved for
intentional local experiments and should not be committed to CI.

## Recovery

Lifecycle Problems identify `startup`, `migration`, `health-check`, or `cleanup`
and retain the last 200 container log lines.

1. Run `docker info` and restart the daemon if it is unavailable.
2. Pull the exact image from the Problem evidence to distinguish registry
   access from startup failure.
3. For migration failures, inspect the named SQL file in retained logs and
   rerun against a newly created resource.
4. For cleanup failures, inspect `docker ps -a`, stop the remaining container,
   and retry after restarting the daemon.
5. Run the focused acceptance suite:

```bash
pnpm --filter @croco/testing-resources test:real
```
