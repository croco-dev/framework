# Saved reports

This standalone React example connects `SavedItems`, `ContinueCard`, and `SavedIntentConsole`
to one `createSavedIntentService` with durable PostgreSQL storage. It needs no ExperienceSlot,
Goal, Journey, or external content engine. The app-owned report repository resolves current
source access and returns report titles only after permission, deletion, and expiry checks.

Run against a disposable PostgreSQL database:

```sh
export SAVED_INTENTS_DATABASE_URL=postgresql://localhost/saved_intents
pnpm --dir examples/saved-intents migrate
pnpm --dir examples/saved-intents dev
```

The explicit migration command installs the saved-intent tables and the app-owned report
schema with three sample reports. Run it once on a fresh database; application startup never
runs DDL. Open http://127.0.0.1:4180. `PORT` changes the loopback server port and allowed origin.
`pnpm --dir examples/saved-intents typecheck` checks the example after workspace dependencies
have been built.

Save a report, pin it, mark it completed, or remove it. The Save action explicitly restores a
removed report using its current revision. Continue first rechecks the server resolver, then
navigates to the report route, which independently verifies source permission. Responses use
`Cache-Control: no-store`; private titles and report bodies remain in the source repository.
The server reads pages of two candidates, retaining Croco's pinned/recent/stable-id ordering.
Restarting the process preserves saved, completed, removed, and policy state.

The console edits the same report policy used by the customer list, with actor, reason,
revision, and idempotency metadata. Its inspection target is an opaque server-authorized
selection and returns masked diagnostics. Provider failures produce an error state, never an
empty list. Revoking or deleting a source report makes its existing saved item unavailable.

This local example binds to loopback and uses one fixed server-owned demo customer/operator.
A deployed application must supply its authenticated session and role checks at this boundary;
request bodies never choose a tenant, subject, principal, or actor. The fixed report catalog
contains synthetic data only. Privacy deletion and retention maintenance are service APIs;
call `deleteSubject` or `purgeRetention` from the application's authorized lifecycle worker.
