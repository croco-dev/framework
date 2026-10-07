---
"@croco/credits-core": patch
"@croco/credits-drizzle": patch
---

Replay expiry commands with an omitted `asOf` after the clock advances. Explicit cutoffs remain part of the idempotency contract, and pagination examples now derive a stable cutoff from the run identifier.

Custom `CreditLedgerStore` implementations must handle the now-optional `ExpireCreditsCommand.asOf`: use `command.asOf ?? command.occurredAt` for expiry eligibility and validate `asOf` only when supplied. Keep the omitted cutoff out of the semantic fingerprint.

Existing idempotency records are unchanged. Before this update, omitted cutoffs were recorded as explicit dates; those records still require the original cutoff for replay. The stable omitted-cutoff behavior applies to commands first recorded after the update.
