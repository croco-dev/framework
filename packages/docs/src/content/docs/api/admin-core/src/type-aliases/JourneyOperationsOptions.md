---
editUrl: false
next: false
prev: false
title: "JourneyOperationsOptions"
---

> **JourneyOperationsOptions** = `object`

## Properties

### store

> **store**: `Pick`\<[`JourneyStore`](/api/lifecycle-core/src/interfaces/journeystore/), `"list"`\>

## Methods

### authenticate()

> **authenticate**(): `Promise`\<`Readonly`\<\{ `actor`: `string`; `permissions`: readonly [`JourneyAdminPermission`](/api/admin-core/src/type-aliases/journeyadminpermission/)[]; `scope`: [`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/); \}\>\>

Resolve the authenticated server session; never bind this to request-supplied grants.

#### Returns

`Promise`\<`Readonly`\<\{ `actor`: `string`; `permissions`: readonly [`JourneyAdminPermission`](/api/admin-core/src/type-aliases/journeyadminpermission/)[]; `scope`: [`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/); \}\>\>

---

### command()

> **command**(`scope`, `episodeId`, `command`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### episodeId

`string`

##### command

[`JourneyCommand`](/api/lifecycle-core/src/type-aliases/journeycommand/)

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

---

### dryRun()

> **dryRun**(`scope`, `definition`, `sampleId`): `Promise`\<`Readonly`\<\{ `steps`: readonly `object`[]; \}\>\>

Resolve only registered, scope-bound sample IDs and execute without dispatch or persistence.

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### definition

[`JourneyDefinition`](/api/lifecycle-core/src/type-aliases/journeydefinition/)

##### sampleId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `steps`: readonly `object`[]; \}\>\>
