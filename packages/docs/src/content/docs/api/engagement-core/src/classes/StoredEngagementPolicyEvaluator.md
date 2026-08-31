---
editUrl: false
next: false
prev: false
title: "StoredEngagementPolicyEvaluator"
---

Resolves durable suppressions and recipient/tenant preference state fail-closed.

## Implements

- [`EngagementSuppressionEvaluator`](/api/engagement-core/src/interfaces/engagementsuppressionevaluator/)

## Constructors

### Constructor

> **new StoredEngagementPolicyEvaluator**(`preferences`, `suppressions`, `options?`): `StoredEngagementPolicyEvaluator`

#### Parameters

##### preferences

[`EngagementPreferenceStore`](/api/engagement-core/src/interfaces/engagementpreferencestore/)

##### suppressions

[`SuppressionStore`](/api/engagement-core/src/interfaces/suppressionstore/)

##### options?

[`StoredEngagementPolicyOptions`](/api/engagement-core/src/type-aliases/storedengagementpolicyoptions/) = `{}`

#### Returns

`StoredEngagementPolicyEvaluator`

## Methods

### evaluate()

> **evaluate**(`context`): `Promise`\<`Readonly`\<\{ `kind?`: `"preference"` \| `"suppression"`; `reason?`: `string`; `suppressed`: `boolean`; \}\>\>

#### Parameters

##### context

[`EngagementSuppressionContext`](/api/engagement-core/src/type-aliases/engagementsuppressioncontext/)

#### Returns

`Promise`\<`Readonly`\<\{ `kind?`: `"preference"` \| `"suppression"`; `reason?`: `string`; `suppressed`: `boolean`; \}\>\>

#### Implementation of

[`EngagementSuppressionEvaluator`](/api/engagement-core/src/interfaces/engagementsuppressionevaluator/).[`evaluate`](/api/engagement-core/src/interfaces/engagementsuppressionevaluator/#evaluate)
