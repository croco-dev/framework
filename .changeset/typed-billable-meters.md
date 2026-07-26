---
"@croco/metering-core": minor
"@croco/metering-drizzle": minor
"@croco/problems-core": patch
---

Define typed, deterministic meter descriptors and validate billable usage envelopes before recording usage.

Billing-required meters now require stable event identities, declared dimensions retain literal value domains, and
COUNT meters can be used directly with `@Metered`. The existing string-based recording API remains available as a
compatibility path.

When adopting typed usage envelopes with `@croco/metering-drizzle`, configure both the `eventId` and `dimensions`
column mappings and apply the exported migration for the selected dialect before recording typed fields.
