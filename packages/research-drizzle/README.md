# @croco/research-drizzle

PostgreSQL/Drizzle provider for `@croco/research-core`. Alpha, uncertified; tested synthetic
persistence is distinct from live recruitment and production certification.

`DrizzleResearchStore` implements the ResearchStore contract. The `research_studies` table keys
one bounded study aggregate by JSON-encoded app/environment/tenant/study identity. Study,
candidates, latest consent, invitations, private notes and status/audit/idempotency history are
committed together as JSONB. Inserting an empty aggregate followed by `SELECT FOR UPDATE`
serializes initial creation and all quota/admission writes across independent connections.
Rejected operations roll back. Read methods do no DDL and do not mutate persisted state.

The study aggregate is intentionally bounded to 10,000 candidates and 50,000 commands. It is
suited to research recruitment rather than a generic large-scale audience engine. API pages are
bounded but the store loads the aggregate to enforce quotas and consent; partition studies before
reaching these explicit limits. Do not share a single long-running transaction with dispatch.

## Migration and recovery

Run `createResearchSchema(db)` as an explicit reviewed migration **before** deploying consumers;
never during application boot. It creates the additive `research_studies` table and can be applied
again. Wire `new DrizzleResearchStore(drizzle(pool, { schema: { researchStudies } }))` into the
application-owned service. No second migration owner or version bump is needed.

A code rollback preserves the table and all admission, consent and participation records. Do not
drop it or recreate studies to clear contact caps. Disposable verification databases are cleaned up by the test harness; production code rollback
never drops recruitment or audit data. Unknown external acceptance is
reconciled through the domain service with verified provider evidence, never by database resets.
Native PostgreSQL rollback protects failed mutations. `research/persistence` masks raw provider
errors. Hosts must protect database credentials, backups and field access and run the explicit
note-retention purge command; neither sampled traces nor backups are consent authorities.

## Verification

```bash
pnpm --filter @croco/research-drizzle test
RESEARCH_POSTGRES_URL=postgresql://... pnpm --filter @croco/research-drizzle test:postgres
```

Use only a disposable synthetic database for integration tests: the test suite truncates and drops
its own table. Two connections verify concurrent group claims, rollback, migration reapplication,
tenant isolation and recovery with a fresh pool. These tests do not send recruitment messages.

Dependencies: `@croco/research-core`, `@croco/problems-core`, and `drizzle-orm`.

## Optional micro surveys


PostgreSQL persistence for `@croco/research-core` micro surveys using Drizzle's node-postgres database. This provider is alpha and has no production certification claim.

`DrizzleSurveyStore` implements `SurveyStore`. It creates a PostgreSQL transaction for each operation and holds a transaction-scoped advisory lock keyed by tenant, application, and environment. Scope-wide serialization preserves publication revisions, invitation frequency claims across versions, exposure/dismissal transitions, and one current response per invitation across processes and connections. This favors a simple, provable concurrency contract over high survey write throughput; long eligibility predicates delay other survey work in the same scope. Keep predicates bounded and avoid network calls under the transaction.

## Migration and state

Run the explicit `addMicroSurveys` migration through the application's existing migration owner before using the store. The migration adds the `research_records` table and indexes and is idempotent. It does not run on provider construction or ordinary application boot. The standalone example deliberately provisions a disposable schema for synthetic demonstration only.

Records have an explicit kind: immutable definition publication, invitation, response, or audit. The composite primary key includes the full scope, kind, and record ID. Current responses occupy the invitation ID; preceding response revisions occupy an encoded invitation/revision ID and are excluded from current-response pages. There is one current response slot per invitation. Definition revision indexes reject duplicate publication revisions. Family and subject indexes support scoped bounded reads and frequency counts. The server manager owns state transition validation; use the manager rather than writing records directly.

`surveyTokenCodec` creates independent 256-bit bearer tokens with SHA-256 digests. Only digests are stored in invitations. PostgreSQL or transaction failures become `research/survey-unavailable`; raw tokens and SQL details are not included in that Problem. This provider preserves the manager's business Problems through transaction rollback.

Raw deletion and retention cleanup scrub all response revisions for an invitation. They do not delete response counts or audit metadata. See the core package for the raw versus metadata policy and the application's bounded retention sweep responsibility. A rollback to the previous application does not restore erased answers. Never drop the table to roll back a deployment that must preserve collected responses.

## Validation

Ordinary validation: `pnpm --filter @croco/research-drizzle test` and `pnpm --filter @croco/research-drizzle typecheck`.

Set `RESEARCH_POSTGRES_URL` to an explicitly disposable PostgreSQL database and run `pnpm --filter @croco/research-drizzle test:live`. Tests create a unique schema, apply the migration twice, exercise two independent pools, reconstruct managers, and drop only their own schema. With no URL, the live suite is skipped; that is not database evidence. [Standalone example](../../examples/micro-surveys/README.md).
