---
editUrl: false
next: false
prev: false
title: "EngagementPreferenceStore"
---

## Extended by

- [`EngagementStoreTransaction`](/api/engagement-core/src/interfaces/engagementstoretransaction/)

## Methods

### resolvePreference()

> **resolvePreference**(`input`): `Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

#### Parameters

##### input

[`EngagementPreferenceLookup`](/api/engagement-core/src/type-aliases/engagementpreferencelookup/)

#### Returns

`Promise`\<`Readonly`\<\{ `changedAt`: `Date`; `channel`: `"email"` \| `"push"` \| `"sms"` \| `"inApp"`; `evidence?`: `Readonly`\<\{ `bounceKind?`: `"hard"` \| `"soft"`; `providerCategory?`: `string`; `providerCode?`: `string`; \}\>; `recipientId?`: `string`; `scope`: [`EngagementPreferenceScope`](/api/engagement-core/src/type-aliases/engagementpreferencescope/); `source`: `string`; `state`: [`EngagementPreferenceState`](/api/engagement-core/src/type-aliases/engagementpreferencestate/); `tenantId`: `string`; `topic`: `string`; \}\> \| `undefined`\>

---

### setPreference()

> **setPreference**(`preference`): `Promise`\<`void`\>

#### Parameters

##### preference

[`EngagementPreference`](/api/engagement-core/src/type-aliases/engagementpreference/)

#### Returns

`Promise`\<`void`\>
