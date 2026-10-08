# @croco/gamification-drizzle

PostgreSQL persistence for `@croco/gamification-core` cooperative challenges.

```ts typecheck
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import {
  DrizzleChallengeStore,
  challengeSchema,
  createChallengeSchema,
} from "@croco/gamification-drizzle";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = drizzle(pool, { schema: challengeSchema });
// Run explicitly in the reviewed migration path, before application boot.
await createChallengeSchema(db);
const store = new DrizzleChallengeStore(db);
```

`transact(scope, challengeId, operation)` inserts a scoped lock bucket and locks it with
`SELECT FOR UPDATE`, including when the challenge does not exist yet. Membership,
contributions, evidence attempts, mutation receipts, progress and the unique logical completion intent
commit in the same transaction. Callback errors roll back all writes. Another pool or
process can resume from persisted rows; no in-memory fallback exists.

The schema uses separate challenge, membership, contribution, receipt, completion and
privacy tombstone tables. Pending evidence attempts persist across restart and prevent settlement
until an explicit contribution retry resolves them; the adapter does not retry sources automatically.
Accepted or rejected attempts cannot return to unknown. Membership intervals are JSON date strings, decoded into
`Date` values at the boundary. Contributions are ordered by acceptance time, numeric
revision and event ID. Transactions load the complete challenge aggregate and rewrite
its child rows when changed; this adapter targets bounded cooperative groups, not
unbounded analytics workloads.

`eraseSubject` deletes identifying membership and contribution records and removes
subject linkage and actor/reason data from affected receipts. The service updates
anonymous aggregate progress according to its explicit leave policy. Receipts never
cache a personal result snapshot. Opaque event and subject tombstones prevent replay
and rejoining after erasure; they are pseudonymous suppression records and need the
application's retention policy. Completion stores an anonymous final aggregate and
represents one logical intent, not proof of externally delivered effects.

`createChallengeSchema` is an explicit, reapplicable migration for initial installation.
`dropChallengeSchema` is destructive and intended for disposable fixture databases.
Neither is called by the store constructor or application runtime.

Validation:

```sh
pnpm --filter @croco/gamification-drizzle test
GAMIFICATION_POSTGRES_URL=postgresql://... pnpm --filter @croco/gamification-drizzle test:postgres
```

The PostgreSQL suite requires a dedicated disposable database: it drops and truncates
these tables. It covers two independent connections, concurrent initial creation and
final contributions, duplicate completion, a fresh pool, rollback, scope isolation,
erasure and migration reapplication. Without the environment variable it is skipped.
