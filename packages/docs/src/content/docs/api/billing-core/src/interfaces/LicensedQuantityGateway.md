---
editUrl: false
next: false
prev: false
title: "LicensedQuantityGateway"
---

## Methods

### getQuantity()

> **getQuantity**(`externalSubscriptionId`): `Promise`\<[`LicensedQuantityObservation`](/api/billing-core/src/type-aliases/licensedquantityobservation/)\>

#### Parameters

##### externalSubscriptionId

`string`

#### Returns

`Promise`\<[`LicensedQuantityObservation`](/api/billing-core/src/type-aliases/licensedquantityobservation/)\>

---

### setQuantity()

> **setQuantity**(`input`): `Promise`\<[`SetLicensedQuantityResult`](/api/billing-core/src/type-aliases/setlicensedquantityresult/)\>

Applies one logical quantity update idempotently.

Implementations must return `duplicate` for a replayed operation identity and `stale` without
mutating provider state when a newer source version was already accepted. A reconciliation can
use a new operation identity after observing new provider-side drift.

#### Parameters

##### input

[`SetLicensedQuantityInput`](/api/billing-core/src/type-aliases/setlicensedquantityinput/)

#### Returns

`Promise`\<[`SetLicensedQuantityResult`](/api/billing-core/src/type-aliases/setlicensedquantityresult/)\>
