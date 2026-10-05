# Activation candidate explorer

Run `pnpm --dir examples/activation-candidates dev`, then open http://127.0.0.1:4321.
The primary action selects a candidate and cohort, saves a verified report, and exports that saved report.
The host stores reports in a temporary directory printed at startup. Reloading the page does not erase
reports; restarting creates a new isolated directory. This is a local synthetic demonstration, not a deployed authentication adapter.

The default fixture contains 100 eligible new users, anchored on 2026-08-01 UTC with complete
28-day observation. Outcomes are measured during days 14–28. The first-week frequency threshold
of one has DO=40, RE=30, NO=20: precision 0.75, coverage 0.60, NOREDO 0.50.
Thresholds two and three increase precision while reducing coverage. The example also compares
active days in a fortnight window. Flat columns explicitly bind each action, count mode and window;
they never imply that aggregate counts are event logs. Verified achievement timestamps are absent,
so achievement curves are explicitly unsupported.

`pnpm --dir examples/activation-candidates test` checks these denominators, common CSV/JSONL
source decoding and the registered MetricReadService query. The service resolves its principal,
field grant, source revision and budget on the server.

`pnpm --dir examples/activation-candidates smoke` starts a temporary real PostgreSQL resource
using the repository testing-resource provider (Docker or its configured native provider is required).
It compiles a fact descriptor, validates and writes subjects, seals and publishes a candidate,
reads the pinned snapshot in bounded 17-row pages while a second publication advances the head,
verifies the original 100 rows and current 101 rows separately, then suppresses a subject through
the catalog and proves that the new stored privacy epoch rejects old cursors and snapshots.
The native report pins its source revision and run reference to the published snapshot ID. The smoke is explicit and is not part of the normal test command.

For browser evidence use `?state=partial`, `empty`, `denied`, `error`, or `loading`.
These are fixed local demo scenarios, not supplied principals or permissions. The server resolves
scope and grants and validates same-origin report writes; the denied scenario grants no read or
write capability. Partial observations exclude five outcomes. Loading delays the read for 1.5 seconds.
Save and export call ActivationCandidateOperations, which verifies current scope, source run and
hashes against the immutable source before returning the saved artifact. Errors remain errors.
The exported report is descriptive association and does not select an optimum or establish causality.

`?state=timed` uses a separate two-subject event fixture with four explicit timestamps on
August 2–4. Every event is on a different UTC activity day. It derives counts and threshold-specific
achievement times from those events and renders the supported cumulative curve. It does not
infer event times from the default aggregate-only fixture.
