# Standalone research recruitment

Synthetic fixture using the actual ResearchService, ResearchOperations, RecipientDirectory and
EngagementService. The notification dispatcher returns local execution receipts and never sends
external messages. No Survey, Cohort Builder, Contact Policy or calendar SaaS is required.

```bash
pnpm build --filter=@croco-example/research-recruitment...
pnpm --filter @croco-example/research-recruitment test
pnpm --dir packages/admin-react exec vitest run src/tests/ResearchRecruitmentConsole.spec.ts
```

`createRecruitmentFixture` returns the scoped service and operations. The browser test mounts the
actual Console, forwards actions through a local HTTP fixture to those operations, and verifies
selection, invitation, consent, acceptance, participation, replacement and note deletion. Its
screenshots are stored outside the checkout. The fixture uses in-memory storage only for synthetic
verification. Real deployments use the PostgreSQL adapter, server-verified authorization, approved
booking URL and a durable EngagementService with recipient preference checks and native logical
send idempotency. These verification artifacts do not certify production recruitment.
