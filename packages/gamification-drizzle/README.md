# @croco/gamification-drizzle

PostgreSQL persistence for cooperative challenges, server-verified achievement rewards, and recurring missions. Each provider has an explicit migration owned by the application.

## Cooperative challenges

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
GAMIFICATION_POSTGRES_URL=postgresql://... REWARDS_POSTGRES_URL=postgresql://... MISSIONS_POSTGRES_URL=postgresql://... pnpm --filter @croco/gamification-drizzle test:postgres
```

The PostgreSQL suite requires a dedicated disposable database: it drops and truncates
these tables. It covers two independent connections, concurrent initial creation and
final contributions, duplicate completion, a fresh pool, rollback, scope isolation,
erasure and migration reapplication. Challenge tests are skipped without `GAMIFICATION_POSTGRES_URL`.
The combined live command also runs reward tests, which require `REWARDS_POSTGRES_URL` and fail
explicitly when it is missing. Mission tests are skipped without `MISSIONS_POSTGRES_URL`. Set all
three variables to dedicated disposable test databases to run every provider suite.

## Achievement rewards

Alpha PostgreSQL persistence for `@croco/gamification-core`. Construct `DrizzleRewardStore(db)` with a Node PostgreSQL Drizzle database and pass it to `RewardService`. The constructor runs no DDL.

Run `createRewardSchema(db)` once as an explicit deployment migration in the application's migration history. It atomically creates policy-family counters, immutable audited publications, durable selections/grants, point entries, and badge ownership. This initial schema has no prior reward schema to migrate. Reapplying the initial migration fails instead of silently accepting drift; applications own migration identity and rollback. Rollback requires preserving grant evidence and ledgers, not dropping live reward tables.

Family row locks serialize publication and selection/cap reservation at PostgreSQL READ COMMITTED. The logical grant key is the database primary key and excludes version. Selection and primary/fallback reservation commit together. Settlement locks the grant and atomically appends a point entry or inserts unique badge ownership before committing the grant state. Duplicate badges are explicit rejections and cannot trigger another selection. Reads use a consistent repeatable-read snapshot.

After process restart, retry `grantForEvidence` with the original identity to recover an unfinished reservation. A failure or uncertain commit acknowledgement is a persistence Problem, never success. Reads can expose the persisted receipt for diagnosis. No external credit payout or implicit reconciliation adapter is included.

The store is an infrastructure primitive; application authorization and evidence ownership must be supplied through `RewardService` verifiers. All identifiers include app, environment, and tenant. Tests and operator test grants require isolated scopes.

Run package `test`, `typecheck`, `build`, and `lint`. For the two-connection, restart, migration and concurrency suite, set `REWARDS_POSTGRES_URL` to a disposable database and run `pnpm --filter @croco/gamification-drizzle test:postgres`. The suite owns a temporary schema and removes it afterward. A missing database URL fails the live command explicitly. Passing local tests do not establish provider certification or npm release.

## Recurring missions

PostgreSQL persistence for `@croco/gamification-core`. Construct `DrizzleMissionStore(db, txManager)` with a PostgreSQL Drizzle client and its shared `TxManager`, then pass the store to `MissionService` alongside authorization and evidence verification ports.

Run `addGamificationMissions(db)` through the application's migration owner before use. The store performs no boot DDL. `removeGamificationMissions(db)` removes the four tables and their history; use it only for intentional teardown.

Definitions preserve actor, reason, revision, idempotency key and publication time. Versions are immutable, revisions increase by one, and matching idempotent publication returns the original audit record. Instance scope includes app, environment, tenant, subject, mission, version, episode and period. A transaction lock serializes creation, and a row lock protects existing progress. Evidence and unique completions commit with progress through the caller's ambient transaction. Configure `TxManager` with `createDrizzleTxAdapter(db)` and savepoint support enabled; nested store operations use its savepoint queue to serialize concurrent `Promise.all` evidence within the same ambient transaction.

Evidence identity is unique across versions and episodes within the same app/environment/tenant/subject/mission. Reusing an event in a changed timezone therefore cannot earn a second count. Evidence stores the minimized service receipt rather than a domain payload. Corrections retain original receipts and historical completion; this package does not grant or revoke rewards or send notifications.

`read` restores the pinned definition, instances, evidence and completion history after restart. Use `MissionService` for authorized reads and mutations; the store is an internal persistence port, not an access-control boundary.

### Completion subscriptions

To deliver logical completions, explicitly supply an existing `TransactionalOutbox` as the third constructor argument. Its event store, mission store and caller must use the same `TxManager` and database. Configure the shared `croco_outbox_messages` table through the application's existing event migration owner; the mission migration does not create it.

```ts
import {
  TransactionalOutbox,
  TransactionalOutboxRelay,
  createEventBusOutboxPublisher,
} from "@croco/events-tx";
import { DrizzleMissionStore, MissionCompletedDomainEvent } from "@croco/gamification-drizzle";

const outbox = new TransactionalOutbox({ store: eventStore, txManager });
const missionStore = new DrizzleMissionStore(db, txManager, outbox);

// The application supplies the EventBus and its subscriber instance.
eventBus.subscribe({
  eventName: MissionCompletedDomainEvent.eventName,
  handlerClass: CompletionObserver,
  handler: completionObserver,
  handlerId: "mission-completion-observer",
});
const relay = new TransactionalOutboxRelay({
  store: eventStore,
  publish: createEventBusOutboxPublisher(eventBus),
});
await relay.publishBatch();
```

`gamification.mission.completed` contains `{ key, completion }`, preserving the subject scope, mission version, episode, period, original completion receipt and achievement time. A scoped SHA-256 identity fits the existing outbox's identifier limits. Progress, completion and outbox append commit atomically; an append failure aborts that mutation. Retries use the same event identity. Consumers must deduplicate delivery using the event ID or the existing transactional inbox. The relay lifecycle and delivery policy belong to the application. No reward, reminder or notification subscriber is installed by this package.

Without an explicitly supplied outbox, the store persists completion history and `MissionService.ingestEvidence` returns `completionCreated`; it does not schedule delivery. Selecting an outbox adds durable delivery intent without requiring rewards or reminders.

### Verification

```sh
pnpm --filter @croco/gamification-drizzle test
GAMIFICATION_POSTGRES_URL=postgresql://... REWARDS_POSTGRES_URL=postgresql://... MISSIONS_POSTGRES_URL=postgresql://... pnpm --filter @croco/gamification-drizzle test:live
```

The live suite creates and drops the package tables and requires a dedicated test database. It exercises migrations, two independent connection pools, simultaneous final evidence, rollback, restart/correction history, publication conflicts and scope isolation. The default test command excludes this destructive database suite.
