# Activation guide with a confirmed report action

This example uses `GoalManager`, `DrizzleGoalStore`, the existing transactional outbox, `ActivationGuideConsole`, `GoalProgress`, and `NextActionCard`. A report saved in PostgreSQL supplies the server-confirmed receipt. The report insert, receipt, progress update, and achieved outbox message share one transaction. Replaying the same report command does not advance progress again.

Start a disposable PostgreSQL database and run:

```bash
export ONBOARDING_EXAMPLE_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/postgres
pnpm --filter @croco-example/onboarding-goals dev
```

Open [http://127.0.0.1:4320/](http://127.0.0.1:4320/). The next action link opens the report form. Save the report to see the goal achieved. The console can preview the verified demo member and publish a new definition revision; an existing episode retains its original policy.

With the server running, verify the HTTP path with `pnpm --filter @croco-example/onboarding-goals smoke`. The smoke checks cross-tenant denial, domain report progress, duplicate command handling, achievement, and v1 policy pinning after v2 publication.

Each server run creates a unique `onboarding_goals_example_*` schema in the disposable database. The sample uses a fixed operator and subject, and binds only to loopback. A production host supplies authentication, operator permissions, verified subject resolution, a domain evidence verifier, its own migration lifecycle, and an outbox relay or worker. The outbox table must exist before goal receipts can be recorded. The example leaves its schema for inspection; discard the database after use.
