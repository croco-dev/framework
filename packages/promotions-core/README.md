# @croco/promotions-core

Code-registered promotional offers with controlled eligibility, stacking, and
budget. Register each policy with `registerOfferPolicy({ id, version,
benefitCycleId, benefit, eligibility, startsAt, endsAt, perSubjectLimit,
budget, ... })`; limits are mandatory and unlimited is never implied.

`OfferService` exposes `evaluateEligibility`, `quoteOffer`, `reserveClaim`,
`fulfillClaim`, and `reconcileClaim`. Eligibility is checked at exposure and
rechecked server-side at acceptance, so a customer who lost eligibility after
exposure is rejected. Quotes pin the benefit snapshot, amounts, currency, and
policy version; later revisions never rewrite confirmed claims.

Budgets lock per claim reservation against the policy version total, with face
value and actual cost tracked separately. The same logical claim key replays
the same receipt while a different payload under the same key conflicts.
Per-subject limits count by policy family and explicit benefit cycle id, so a
revision alone never resets them. Non-stackable claims in one stacking group
conflict.

Trial credits fulfill through `FirstPartyCreditGrantAdapter` into the existing
credit ledger with a deterministic idempotency key: retries after response
loss confirm the original grant instead of paying twice. Grants whose outcome
stays unclear become `indeterminate` with their budget locked until
`reconcileClaim` observes the grant or an operator resolves the claim.
Discount quotes are pure `Money` math via `quoteDiscount`; providers without
an implemented discount feature report `supported: false` and refuse
reservation instead of pretending the discount exists.

Use `@croco/promotions-drizzle` for PostgreSQL persistence.
`examples/promotion-offers` demonstrates the complete path.
