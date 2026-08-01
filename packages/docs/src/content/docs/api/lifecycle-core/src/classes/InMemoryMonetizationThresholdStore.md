---
editUrl: false
next: false
prev: false
title: "InMemoryMonetizationThresholdStore"
---

## Implements

- [`MonetizationThresholdStore`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/)

## Constructors

### Constructor

> **new InMemoryMonetizationThresholdStore**(`options?`): `InMemoryMonetizationThresholdStore`

#### Parameters

##### options?

[`InMemoryMonetizationThresholdStoreOptions`](/api/lifecycle-core/src/type-aliases/inmemorymonetizationthresholdstoreoptions/) = `{}`

#### Returns

`InMemoryMonetizationThresholdStore`

## Methods

### acknowledgeCrossings()

> **acknowledgeCrossings**(`claimId`): `Promise`\<`void`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`MonetizationThresholdStore`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/).[`acknowledgeCrossings`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/#acknowledgecrossings)

***

### claimCrossings()

> **claimCrossings**(`claim`): `Promise`\<[`MonetizationThresholdClaimResult`](/api/lifecycle-core/src/type-aliases/monetizationthresholdclaimresult/)\>

#### Parameters

##### claim

[`MonetizationThresholdClaim`](/api/lifecycle-core/src/type-aliases/monetizationthresholdclaim/)

#### Returns

`Promise`\<[`MonetizationThresholdClaimResult`](/api/lifecycle-core/src/type-aliases/monetizationthresholdclaimresult/)\>

#### Implementation of

[`MonetizationThresholdStore`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/).[`claimCrossings`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/#claimcrossings)

***

### getDiagnostics()

> **getDiagnostics**(): `Promise`\<[`MonetizationThresholdDiagnostics`](/api/lifecycle-core/src/type-aliases/monetizationthresholddiagnostics/)\>

#### Returns

`Promise`\<[`MonetizationThresholdDiagnostics`](/api/lifecycle-core/src/type-aliases/monetizationthresholddiagnostics/)\>

#### Implementation of

[`MonetizationThresholdStore`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/).[`getDiagnostics`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/#getdiagnostics)

***

### releaseCrossings()

> **releaseCrossings**(`claimId`): `Promise`\<`void`\>

#### Parameters

##### claimId

`string`

#### Returns

`Promise`\<`void`\>

#### Implementation of

[`MonetizationThresholdStore`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/).[`releaseCrossings`](/api/lifecycle-core/src/interfaces/monetizationthresholdstore/#releasecrossings)
