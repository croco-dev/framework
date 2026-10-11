# Recurring missions

A standalone PostgreSQL-backed report-saving mission. The React progress card, activity calendar,
achievement notice, and operator console use the same `MissionService` as the report command.
No onboarding goal, reward grant, or reminder dependency is required.

## Run

Use a local PostgreSQL database reserved for this example:

```sh
export GAMIFICATION_POSTGRES_URL=postgres://postgres:postgres@127.0.0.1:55415/missions_example
pnpm --dir examples/recurring-missions migrate
pnpm --dir examples/recurring-missions dev
```

Open <http://127.0.0.1:4315/>. `migrate` explicitly installs the mission and example domain tables
and seeds the initial publication/session. Startup performs no DDL. Data remains in PostgreSQL
when the server restarts; run migration against an empty dedicated database for a fresh demo.

```sh
pnpm --dir examples/recurring-missions smoke
pnpm --dir examples/recurring-missions relay
pnpm --dir examples/recurring-missions typecheck
```

The loopback server uses fixed demo member/operator identities. A deployed host must replace this
identity boundary with authenticated sessions and operation permissions. The server owns subject,
report occurrence time, and mission evidence; browser-provided completion counts are never accepted.

## Browser workflow

1. Save a named report. Its server-owned row is verified before mission evidence is accepted.
2. See confirmed progress and activity dates. Only an achieved instance with its completion receipt
   produces an achievement notice. Partial reads preserve known progress and show unavailability.
3. Publish a new immutable policy version in Mission console. Select a code-registered action,
   daily/weekly period, count mode, target, cap, timezone, and audit reason.
4. Start a new episode to use the published policy. The old version, episode, progress, and completion
   history remain intact. Publishing alone does not replace an active episode.

All controls use native form semantics and support keyboard navigation. The browser issues bounded
reads on startup and after commands; it does not poll. Read errors offer an explicit retry. A report
retry retains its command identity until accepted so a lost response does not double count.

`GET /api/bootstrap` supplies the personal progress and operator publication/access model.
`GET /api/progress` refreshes personal progress. `POST /api/reports` saves a domain report;
`POST /api/definition` publishes with actor/reason/revision/idempotency evidence; and
`POST /api/episodes` starts a separate server-generated episode for an existing version.

The example explicitly selects the shared transactional outbox. Run `relay` to consume up to 100 logical completion events using the existing relay. Consumers own delivery idempotency using the stable event ID; the example does not grant rewards or create notifications. Its explicit migration owns the outbox schema, while the mission migration only owns mission tables. Episode transitions use a durable command ID, so retrying a committed transition keeps the same episode.
