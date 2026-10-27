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
deterministic idempotency key (`referral-benefit:<attributionId>:<side>`),
so one side may succeed while the other stays pending without re-paying the
completed side on retry. Program budgets reserve at claim time and remain locked
until rejection or expiry. Per-subject receipt limits count by family and explicit
benefit cycle id, so a revision alone never resets them. Claimed attributions and
novelty holds do not reserve subject receipts. Qualification atomically checks
both subjects before creating either benefit intent; a limit failure leaves the
claim and its budget unchanged so it can still expire normally. Rejected or expired
attributions do not consume the subject limit; partial or uncertain benefits do.
Custom stores must retain family/cycle/subject admission locks from
`countSubjectReceipts` through transaction end and read a fresh committed count
after waiting. Count multiple subjects in stable fingerprint order. Deploy the
updated store and service together after draining older writers; before rollback,
stop and drain writers and reconcile outstanding attributions. Mixed versions cannot
enforce this protocol. No existing excess grants are reversed automatically.

Trial credits fulfill through `FirstPartyReferralCreditGrantAdapter`
(`@croco/referral-core/credit-grant`) into the existing credit ledger with
an explicit account-mapping resolver; the mapped account must exist and
belong to the benefit subject tenant. Grants whose outcome stays unclear
become `indeterminate` with their budget locked until `reconcileBenefits`
observes the grant or an operator resolves the attribution with verified
grant references.

`reconcileBenefits` also resumes an interrupted `granting` intent and completes
remaining pending sides. Each external attempt claims a monotonic
`fulfillmentAttempt`; superseded responses cannot change the current outcome.
A granted response observed after a terminal operator decision is retained as a
`benefit.grant-superseded` audit entry with its receipt and original idempotency key
for reconciliation; the decision and its budget accounting remain unchanged.
The external fulfillment port must deduplicate overlapping calls with the same
idempotency key. A visible receipt completes its side without another grant;
`unknown` without a receipt remains locked for an operator decision. No new
storage migration is required: missing attempt values are treated as zero.
Custom `ReferralTx` providers must implement the optional attempt predicate in
`compareAndSetBenefitIntent` atomically with the status predicate and serialize
attribution lifecycle reads inside transactions with lifecycle writes. Deploy
that provider support with the updated service; older providers that ignore the
predicate cannot fence recovery safely.

Link tokens are issued via `@croco/referral-core/link-token`; only the
SHA-256 hash is persisted. Use `@croco/referral-drizzle` for PostgreSQL
persistence.
