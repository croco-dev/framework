# Fact history with PostgreSQL

This standalone example stores an explicit customer plan and subscription status event in PostgreSQL. It reads the same plan at an effective time before and after the event was recorded, then renders the `FactHistoryPanel` from the authorized history service.

Start a disposable PostgreSQL database, set `FACT_HISTORY_DATABASE_URL`, then run:

```bash
pnpm --filter @croco-example/fact-history start
```

The example uses a dedicated application and tenant scope. It creates its tables and prints the two time-specific results and rendered panel HTML. Use a disposable database: the migration creates persistent tables and the event is append-only. A production application must provide its own authenticated authorization and masking policy; the example grants access solely to its fixed demonstration scope and actor.

`knownAt` is the recorder cutoff and `effectiveAt` is the actual validity time. The earlier cutoff stays unknown even when a later read knows the plan. The example does not infer a customer's past value from a current profile.
