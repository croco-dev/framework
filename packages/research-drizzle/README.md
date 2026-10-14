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
