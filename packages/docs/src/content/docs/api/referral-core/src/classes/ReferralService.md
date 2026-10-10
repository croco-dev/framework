---
editUrl: false
next: false
prev: false
title: "ReferralService"
---

## Constructors

### Constructor

> **new ReferralService**(`options`): `ReferralService`

#### Parameters

##### options

[`ReferralServiceOptions`](/api/referral-core/src/type-aliases/referralserviceoptions/)

#### Returns

`ReferralService`

## Methods

### cancelBenefitSide()

> **cancelBenefitSide**(`input`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

Cancels a pending benefit side before any grant completed. Granted or
already terminal sides never cancel; an explicit policy reversal owns
completed grants instead.

#### Parameters

##### input

###### actorId

`string`

###### attributionId

`string`

###### now?

`Date`

###### policy

`string`

###### reason

`string`

###### side

[`ReferralBenefitSide`](/api/referral-core/src/type-aliases/referralbenefitside/)

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

---

### claimAttribution()

> **claimAttribution**(`input`): `Promise`\<[`ClaimReferralResult`](/api/referral-core/src/type-aliases/claimreferralresult/)\>

Claims attribution for a recipient presenting a raw link token. The first
valid claim for a recipient inside a program family wins; later claims
are held as duplicates without merging or stealing the attribution.
Self-referral, expired or revoked links, other-tenant links, existing
customers, and unknown novelty are rejected or held with distinct
problems — never silently treated as success.

#### Parameters

##### input

[`ClaimReferralAttributionInput`](/api/referral-core/src/type-aliases/claimreferralattributioninput/)

#### Returns

`Promise`\<[`ClaimReferralResult`](/api/referral-core/src/type-aliases/claimreferralresult/)\>

---

### createReferralLink()

> **createReferralLink**(`input`): `Promise`\<[`CreateReferralLinkResult`](/api/referral-core/src/type-aliases/createreferrallinkresult/)\>

Creates a shareable link. The raw token is returned once for sharing and
never persisted: only its SHA-256 hash is stored. The hash alone resolves
claims, so logs and rows never carry the raw token.

#### Parameters

##### input

[`CreateReferralLinkInput`](/api/referral-core/src/type-aliases/createreferrallinkinput/)

#### Returns

`Promise`\<[`CreateReferralLinkResult`](/api/referral-core/src/type-aliases/createreferrallinkresult/)\>

---

### fulfillBenefits()

> **fulfillBenefits**(`input`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

Fulfills both benefit sides with deterministic per-side idempotency keys.
One side may succeed while the other fails or stays unknown; the
attribution records `benefits-partial` without re-paying the completed
side on retry. Unknown outcomes keep the budget locked for `reconcile`.

#### Parameters

##### input

[`FulfillReferralBenefitsInput`](/api/referral-core/src/type-aliases/fulfillreferralbenefitsinput/)

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

---

### funnelCounts()

> **funnelCounts**(`input`): `Promise`\<[`ReferralFunnelCounts`](/api/referral-core/src/type-aliases/referralfunnelcounts/)\>

Funnel counts keep share intent separate from confirmed acquisition and payout.

#### Parameters

##### input

###### familyId?

`string`

###### programId

`string`

#### Returns

`Promise`\<[`ReferralFunnelCounts`](/api/referral-core/src/type-aliases/referralfunnelcounts/)\>

---

### getAttribution()

> **getAttribution**(`attributionId`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

#### Parameters

##### attributionId

`string`

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/) \| `null`\>

---

### listAttributions()

> **listAttributions**(`filter`): `Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

#### Parameters

##### filter

[`ListAttributionsFilter`](/api/referral-core/src/type-aliases/listattributionsfilter/)

#### Returns

`Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

---

### listBenefitIntents()

> **listBenefitIntents**(`filter`): `Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

#### Parameters

##### filter

[`ListBenefitIntentsFilter`](/api/referral-core/src/type-aliases/listbenefitintentsfilter/)

#### Returns

`Promise`\<readonly [`ReferralBenefitIntent`](/api/referral-core/src/type-aliases/referralbenefitintent/)[]\>

---

### qualifyAttribution()

> **qualifyAttribution**(`input`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

Qualifies a claimed attribution against the authoritative server source.
Held attributions with resolved novelty may qualify; expired conversion
windows and rejected qualifications keep distinct states and problems.

#### Parameters

##### input

[`QualifyReferralAttributionInput`](/api/referral-core/src/type-aliases/qualifyreferralattributioninput/)

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

---

### reconcileBenefits()

> **reconcileBenefits**(`input`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

Reconciles benefit intents whose grant outcome is unclear. A visible grant
completes the side; otherwise `granting` sides safely retry the idempotent
grant, while `unknown` sides stay locked for an explicit operator decision.
Reconciliation never releases the budget or pays again on its own.

#### Parameters

##### input

###### attributionId

`string`

###### now?

`Date`

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

---

### recordClick()

> **recordClick**(`input`): `Promise`\<`void`\>

Records a share-intent click; clicks never imply acquisition or success.

#### Parameters

##### input

###### linkId

`string`

###### now?

`Date`

#### Returns

`Promise`\<`void`\>

---

### recoverPendingAttributions()

> **recoverPendingAttributions**(`input?`): `Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

Lists pending attributions so restarts can resume qualification and benefits.

#### Parameters

##### input?

###### limit?

`number`

#### Returns

`Promise`\<readonly [`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)[]\>

---

### registerProgram()

> **registerProgram**(`input`): `Promise`\<\{ `created`: `boolean`; `program`: [`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/); \}\>

#### Parameters

##### input

[`RegisterReferralProgramInput`](/api/referral-core/src/type-aliases/registerreferralprograminput/)

#### Returns

`Promise`\<\{ `created`: `boolean`; `program`: [`ReferralProgramDefinition`](/api/referral-core/src/type-aliases/referralprogramdefinition/); \}\>

---

### resolveIndeterminateBenefits()

> **resolveIndeterminateBenefits**(`input`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

Operator adjustment for indeterminate attributions: explicitly complete
with a verified grant reference per side, or reject and release the locked
budget. Every decision preserves actor, reason, and an audit trail.

#### Parameters

##### input

###### actorId

`string`

###### attributionId

`string`

###### decision

`"fulfilled"` \| `"rejected"`

###### grantRefs?

`Partial`\<`Record`\<[`ReferralBenefitSide`](/api/referral-core/src/type-aliases/referralbenefitside/), `string`\>\>

###### idempotencyKey?

`string`

###### now?

`Date`

###### reason

`string`

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

---

### returnBenefitSide()

> **returnBenefitSide**(`input`): `Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

Returns a completed benefit through an explicit compensating fulfillment
reversal. The reversal posts a new ledger entry keyed by the return
idempotency key; the original grant receipt stays on the intent while the
policy and the return receipt record why value moved back. Other
subjects' confirmed benefits are never touched implicitly.

#### Parameters

##### input

###### actorId

`string`

###### attributionId

`string`

###### now?

`Date`

###### policy

`string`

###### reason

`string`

###### returnIdempotencyKey?

`string`

###### side

[`ReferralBenefitSide`](/api/referral-core/src/type-aliases/referralbenefitside/)

#### Returns

`Promise`\<[`ReferralAttribution`](/api/referral-core/src/type-aliases/referralattribution/)\>

---

### revokeLink()

> **revokeLink**(`input`): `Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/)\>

#### Parameters

##### input

###### actorId

`string`

###### linkId

`string`

###### now?

`Date`

###### reason

`string`

#### Returns

`Promise`\<[`ReferralLink`](/api/referral-core/src/type-aliases/referrallink/)\>
