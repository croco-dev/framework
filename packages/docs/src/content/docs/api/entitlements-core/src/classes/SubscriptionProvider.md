---
editUrl: false
next: false
prev: false
title: "SubscriptionProvider"
---

## Extended by

- [`StaticSubscriptionProvider`](/api/entitlements-core/src/classes/staticsubscriptionprovider/)
- [`BillingStoreSubscriptionProvider`](/api/entitlements-drizzle/src/classes/billingstoresubscriptionprovider/)

## Constructors

### Constructor

> **new SubscriptionProvider**(): `SubscriptionProvider`

#### Returns

`SubscriptionProvider`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`SubscriptionProvider`\>

## Methods

### getCurrentPlanId()

> `abstract` **getCurrentPlanId**(`tenantId`): `Promise`\<`string` \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<`string` \| `null`\>

---

### getCurrentPlanVersion()?

> `abstract` `optional` **getCurrentPlanVersion**(`tenantId`): `Promise`\<[`SubscriptionPlanReference`](/api/entitlements-core/src/type-aliases/subscriptionplanreference/) \| `null`\>

#### Parameters

##### tenantId

`string`

#### Returns

`Promise`\<[`SubscriptionPlanReference`](/api/entitlements-core/src/type-aliases/subscriptionplanreference/) \| `null`\>
