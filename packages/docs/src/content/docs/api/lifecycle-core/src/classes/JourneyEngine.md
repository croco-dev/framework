---
editUrl: false
next: false
prev: false
title: "JourneyEngine"
---

## Constructors

### Constructor

> **new JourneyEngine**(`options`): `JourneyEngine`

#### Parameters

##### options

[`JourneyEngineOptions`](/api/lifecycle-core/src/type-aliases/journeyengineoptions/)

#### Returns

`JourneyEngine`

## Methods

### command()

> **command**(`scope`, `id`, `command`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### id

`string`

##### command

[`JourneyCommand`](/api/lifecycle-core/src/type-aliases/journeycommand/)

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

---

### dryRun()

> **dryRun**(`id`, `version`, `input`): `Promise`\<[`JourneyDryRunResult`](/api/lifecycle-core/src/type-aliases/journeydryrunresult/)\>

#### Parameters

##### id

`string`

##### version

`string`

##### input

[`JourneyEntry`](/api/lifecycle-core/src/type-aliases/journeyentry/)

#### Returns

`Promise`\<[`JourneyDryRunResult`](/api/lifecycle-core/src/type-aliases/journeydryrunresult/)\>

---

### enter()

> **enter**(`id`, `version`, `input`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

#### Parameters

##### id

`string`

##### version

`string`

##### input

[`JourneyEntry`](/api/lifecycle-core/src/type-aliases/journeyentry/)

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

---

### reconcile()

> **reconcile**(`scope`, `id`, `reconciliation`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### id

`string`

##### reconciliation

[`JourneyReconciliation`](/api/lifecycle-core/src/type-aliases/journeyreconciliation/)

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

---

### register()

> **register**(`definition`): `void`

#### Parameters

##### definition

[`JourneyDefinition`](/api/lifecycle-core/src/type-aliases/journeydefinition/)

#### Returns

`void`

---

### tick()

> **tick**(`scope`, `id`, `expectedRevision?`): `Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>

#### Parameters

##### scope

[`JourneyScope`](/api/lifecycle-core/src/type-aliases/journeyscope/)

##### id

`string`

##### expectedRevision?

`number`

#### Returns

`Promise`\<[`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)\>
