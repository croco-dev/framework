---
editUrl: false
next: false
prev: false
title: "JourneyOperations"
---

## Constructors

### Constructor

> **new JourneyOperations**(`options`): `JourneyOperations`

#### Parameters

##### options

[`JourneyOperationsOptions`](/api/admin-core/src/type-aliases/journeyoperationsoptions/)

#### Returns

`JourneyOperations`

## Methods

### command()

> **command**(`scope`, `input`): `Promise`\<[`JourneyEpisodeView`](/api/admin-core/src/type-aliases/journeyepisodeview/)\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### input

[`JourneyAdminCommand`](/api/admin-core/src/type-aliases/journeyadmincommand/)

#### Returns

`Promise`\<[`JourneyEpisodeView`](/api/admin-core/src/type-aliases/journeyepisodeview/)\>

---

### dryRun()

> **dryRun**(`scope`, `definition`, `sampleId`): `Promise`\<`Readonly`\<\{ `steps`: readonly `object`[]; \}\>\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### definition

[`JourneyDefinition`](/api/lifecycle-core/src/type-aliases/journeydefinition/)

##### sampleId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `steps`: readonly `object`[]; \}\>\>

---

### list()

> **list**(`scope`): `Promise`\<readonly [`JourneyEpisodeView`](/api/admin-core/src/type-aliases/journeyepisodeview/)[]\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

#### Returns

`Promise`\<readonly [`JourneyEpisodeView`](/api/admin-core/src/type-aliases/journeyepisodeview/)[]\>
