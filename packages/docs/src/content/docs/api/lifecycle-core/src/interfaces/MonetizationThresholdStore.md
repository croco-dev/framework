---
editUrl: false
next: false
prev: false
title: "MonetizationThresholdStore"
---

## Methods

### acknowledgeCrossings()

> **acknowledgeCrossings**(`claimId`): `Promise`\<`void`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

***

### claimCrossings()

> **claimCrossings**(`claim`): `Promise`\<[`MonetizationThresholdClaimResult`](/api/lifecycle-core/src/type-aliases/monetizationthresholdclaimresult/)\>

#### Parameters

##### claim

[`MonetizationThresholdClaim`](/api/lifecycle-core/src/type-aliases/monetizationthresholdclaim/)

#### Returns

`Promise`\<[`MonetizationThresholdClaimResult`](/api/lifecycle-core/src/type-aliases/monetizationthresholdclaimresult/)\>

***

### getDiagnostics()

> **getDiagnostics**(): `Promise`\<[`MonetizationThresholdDiagnostics`](/api/lifecycle-core/src/type-aliases/monetizationthresholddiagnostics/)\>

#### Returns

`Promise`\<[`MonetizationThresholdDiagnostics`](/api/lifecycle-core/src/type-aliases/monetizationthresholddiagnostics/)\>

***

### releaseCrossings()

> **releaseCrossings**(`claimId`): `Promise`\<`void`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<`void`\>
