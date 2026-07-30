---
editUrl: false
next: false
prev: false
title: "BillingProvider"
---

Explicit billing provider capability profiles and runtime composition.

## Type Parameters

### Profile

`Profile` _extends_ [`BillingProviderProfile`](/api/billing-core/src/type-aliases/billingproviderprofile/) = [`BillingProviderProfile`](/api/billing-core/src/type-aliases/billingproviderprofile/)

## Constructors

### Constructor

> **new BillingProvider**\<`Profile`\>(`profile`, `implementations`): `BillingProvider`\<`Profile`\>

#### Parameters

##### profile

`Profile`

##### implementations

[`BillingProviderImplementations`](/api/billing-core/src/type-aliases/billingproviderimplementations/)\<`Profile`\>

#### Returns

`BillingProvider`\<`Profile`\>

## Properties

### profile

> `readonly` **profile**: `Profile`

## Methods

### requireCapability()

> **requireCapability**\<`Capability`\>(`capability`): `BillingProviderCapabilityMap`\[`Capability`\]

#### Type Parameters

##### Capability

`Capability` _extends_ `"usage"` \| `"checkout"`

#### Parameters

##### capability

`Capability`

#### Returns

`BillingProviderCapabilityMap`\[`Capability`\]

---

### supports()

> **supports**(`capability`): `boolean`

#### Parameters

##### capability

`"usage"` \| `"checkout"`

#### Returns

`boolean`
