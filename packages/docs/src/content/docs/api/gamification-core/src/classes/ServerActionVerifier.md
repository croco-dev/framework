---
editUrl: false
next: false
prev: false
title: "ServerActionVerifier"
---

## Implements

- [`MissionEvidenceVerifier`](/api/gamification-core/src/interfaces/missionevidenceverifier/)

## Constructors

### Constructor

> **new ServerActionVerifier**(`ledger`): `ServerActionVerifier`

#### Parameters

##### ledger

[`MissionServerActionLedger`](/api/gamification-core/src/interfaces/missionserveractionledger/)

#### Returns

`ServerActionVerifier`

## Methods

### verify()

> **verify**(`input`): `Promise`\<`boolean`\>

#### Parameters

##### input

###### evidence

[`MissionEvidence`](/api/gamification-core/src/type-aliases/missionevidence/)

###### key

[`MissionAggregateKey`](/api/gamification-core/src/type-aliases/missionaggregatekey/)

#### Returns

`Promise`\<`boolean`\>

#### Implementation of

[`MissionEvidenceVerifier`](/api/gamification-core/src/interfaces/missionevidenceverifier/).[`verify`](/api/gamification-core/src/interfaces/missionevidenceverifier/#verify)
