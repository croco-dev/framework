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
after waiting. Order multiple subjects by the JSON tuple of `appId`, `environment`, `tenantId`,
`kind` and `id`. Additional object properties do not change identity, admission
order or receipt counts, including on already persisted subjects. Deploy the
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

`returnBenefitSide` claims one `returnOperation` on the granted intent before
calling `reverse`. The first request pins its return key, policy, actor and
reason; later requests for that side, including different caller keys, reuse
that operation. The original grant receipt and the other side remain intact.
Completed operations replay their stored receipt without another debit.
Legacy `returned` intents without operation metadata retain their state-conflict
error because they have no recoverable return receipt.

A thrown error, `{ error }`, empty receipt, or failed local completion write
does not authorize another reversal. Retry `returnBenefitSide` to invoke the
port's optional read-only `checkReturn` with the persisted key. A confirmed
receipt completes the original operation and audit once. A missing receipt or
missing lookup capability reports `ReferralBenefitFailedProblem` and leaves the
operation locked (`returning` or `unknown`), with its budget unchanged. This
also applies to a crash after claiming but before sending: receipt absence
cannot distinguish an unsent request from an in-flight debit. Resolve it at
the provider and expose the verified receipt through `checkReturn`; never
delete the claim or substitute a fresh key to retry an uncertain debit.
The first-party credit adapter queries matching compensating debits from the
existing ledger without posting an adjustment.

Custom transactional providers must persist `returnOperation` in
`compareAndSetBenefitIntent` and serialize its reads and writes through
`getAttribution` inside the same transaction. In-memory storage coordinates
only callers sharing that store instance; PostgreSQL uses the existing
attribution row lock across processes. No distributed guarantee is added to
the in-memory adapter. Metadata is optional in the existing JSON document,
so no SQL migration is required. Drain older service workers before enabling
returns with the updated service/provider pair: older binaries ignore the
operation metadata. Before rolling back, reconcile outstanding returns and
stop return traffic; do not run old and new return handlers concurrently.

Link tokens are issued via `@croco/referral-core/link-token`; only the
SHA-256 hash is persisted. Use `@croco/referral-drizzle` for PostgreSQL
persistence.
