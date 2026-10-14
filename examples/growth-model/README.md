# Growth Model Workbench

A standalone synthetic state-transition model, scenario editor and historical validation workbench.
It uses `metrics-core` calculations through an authorized `admin-core` source and `admin-react` UI.
It needs no other growth feature, database, scheduler, ML service, credentials or production data.

```bash
pnpm --filter @croco-example/growth-model... build
pnpm --filter @croco-example/growth-model start
pnpm --filter @croco-example/growth-model dev
```

Open `http://127.0.0.1:4324`. Calculate, edit the model purpose/state evidence/version, adjust scenario
JSON, calculate again, save a report revision and compare a saved model version. Change the source
selector to exercise empty, incomplete, denied and provider-error inputs. The app intentionally
submits real definitions and assumptions to the server; it does not receive only precomputed tables.
For keyboard use, all editors, calculation, save and compare controls are native labeled controls.

The count fixture fixes the training population cutoff at period 2. Period 3 is held out, including an
actual zero state. Compare MAE with MAPE by editing the backtest error metric: zero actual MAPE stays
undefined with `actual-zero`; the overall mean also stays undefined rather than excluding that cell.
Changing a state definition requires its model version to change before saving another revision.

The row-vector convention is `x[t+1] = x[t] P + i[t]`. The standalone projection oracle is
`[100,0] × [[.8,.2],[.1,.9]] = [80,20]`, followed by `[66,34]`. This example estimates its own pooled
matrix from the declared historical count fixture; that estimated matrix differs from the oracle.
All forecasts are fractional expectations over a finite horizon. Display rounding is presentation
only. A full replacement probability row must include a `replace-row` method and a rationale explaining
its same-row transfer; no implicit reweighting or self-loop repair occurs. Assumed changes do not
establish intervention effects or real predictive power.

`FileReports` uses private temporary files, serializes appends in one process and retains actor,
revision and previous analysis hash for each report. Recreating the source with the same directory
restores a saved report without restoring raw subject history. Restarting this demo chooses a new
temporary directory. This single-process example is not a multi-process production repository.

Hosts must implement authenticated scope/actor, source authorization and privacy/deletion policy,
immutable source revisions, and an atomic compare-and-append audit repository. App, environment and
tenant are always required. The fixed synthetic principal is demo-only; do not expose this server to
untrusted clients. A source must reject exceeded budgets, never silently truncate data. Bounds are
resource controls, not performance guarantees or certification evidence.

Saved results are historical evidence at their pinned cutoff, not fresh forecasts. Reading requires
report authority and verifies scope and report hashes. Producing a new report reauthorizes source reads
and recomputes; saving requires its exact displayed analysis hash. Aggregate counts cannot prove
individual partition membership. State labels, evidence, purpose and assumptions are human-authored
aggregate metadata and must contain no customer PII. No original customer logs are copied into reports.
