# Confirmed payment events to PostgreSQL facts

This example commits a capture and a refund with their outbox events in the same PostgreSQL transactions. A separate relay invocation loads each confirmed event into a warehouse candidate. The fact grain is provider plus capture or refund ID; the event ID remains provenance, so a refund is a separate fact and neither message changes the capture amount.

Start a disposable PostgreSQL database, then run:

```bash
OUTBOX_FACT_DATABASE_URL=postgresql://... pnpm --filter @croco-example/outbox-fact-source start
```

The program installs its local tables, commits the two domain commands, runs the existing outbox relay and analytics inbox consumer, and prints the number and amount of durably accepted facts. It does not mark the warehouse candidate published: a live outbox scan cannot prove complete source coverage or a global commit-order watermark. Publication requires an independently closed source scope and the warehouse catalog's seal checks.

The source metadata is written by the server-side producer. A real application must resolve the warehouse access scope from its authenticated server context and migrate the outbox, inbox, warehouse, and quarantine tables before starting workers. Retained outbox messages can be replayed by exact ID; deleted history needs a separate archive and must be reported unavailable rather than reconstructed from current payment rows.
