# @croco/referral-core

Explicit referral attribution from a shared link through qualification to
dual-side benefits. Register each program with
`registerReferralProgram({ id, version, familyId, benefitCycleId,
qualifyingAction, conversionWindowMs, referrerBenefit, recipientBenefit,
startsAt, endsAt, perSubjectLimit, budgetTotal, budgetPerAttribution, ... })`;
limits are mandatory and unlimited is never implied.

`ReferralService` exposes `createReferralLink`, `claimAttribution`,
`qualifyAttribution`, `fulfillBenefits`, `reconcileBenefits`, and
`resolveIndeterminateBenefits`. Attribution follows first-valid-wins: the
first valid claim for a recipient inside a program family wins, and later
claims are held as duplicates. Qualification and novelty come from
authoritative app-owned server sources, never from client assertions or
IP/device similarity. Self-referrals are rejected, and claiming never joins
the recipient to any organization.

Benefits pin the program snapshot, and each side fulfills with a
deterministic idempotency key (`referral:{familyId}:{cycleId}:{linkId}:{side}`),
so one side may succeed while the other stays pending without re-paying the
completed side on retry. Budgets lock per qualified attribution against the
program total. Per-subject receipt counts by family and explicit benefit
cycle id, so a revision alone never resets them.

Trial credits fulfill through `FirstPartyReferralCreditGrantAdapter`
(`@croco/referral-core/credit-grant`) into the existing credit ledger with
an explicit account-mapping resolver; the mapped account must exist and
belong to the benefit subject tenant. Grants whose outcome stays unclear
become `indeterminate` with their budget locked until `reconcileBenefits`
observes the grant or an operator resolves the attribution with verified
grant references.

Link tokens are issued via `@croco/referral-core/link-token`; only the
SHA-256 hash is persisted. Use `@croco/referral-drizzle` for PostgreSQL
persistence.
