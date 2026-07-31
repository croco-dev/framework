# Static misuse exceptions

Croco treats raw built-in errors and empty runtime catch blocks as temporary exceptions, not permanent
conventions. Prefer converting a finding to a `Problem`, a diagnostic-coded error, explicit telemetry or
logging, or recovery behavior.

When an exception is unavoidable, add a source-pinned entry to the applicable
`scripts/static-misuse-*-allowlist.json` file with all required fields:

- `package`, `file`, `line`, and `excerpt` identify the exact current source line.
- `reason` explains why the normal failure model cannot yet be used.
- `owner` names the team accountable for retiring or extending the exception.
- `expiresOn` is a valid `YYYY-MM-DD` deadline. Expired entries fail `pnpm static-misuse:check`.

Each allowlist also declares `baselineEntryCount`. The count must exactly match its entries, so adding a
suppression requires a deliberate baseline change in the same review. When an exception is removed, lower the
baseline with it; do not reuse the released count for another suppression.

Owners review entries at least quarterly and before their expiry. A review must either remove the exception or
update its reason and expiry with evidence that the exception remains necessary. Keep expiries spread by owning
package so reviews do not collapse onto one date.

Run `pnpm static-misuse:check` and the affected package tests after any allowlist change. To verify gate behavior,
temporarily set an expiry to a past date and temporarily add an entry without changing `baselineEntryCount`; both
checks must fail, and both temporary edits must be reverted.
