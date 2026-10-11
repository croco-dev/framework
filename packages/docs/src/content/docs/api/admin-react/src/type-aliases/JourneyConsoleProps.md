---
editUrl: false
next: false
prev: false
title: "JourneyConsoleProps"
---

> **JourneyConsoleProps** = `object`

## Properties

### definition

> **definition**: [`JourneyDefinition`](/api/lifecycle-core/src/type-aliases/journeydefinition/)

---

### permissions

> **permissions**: readonly [`JourneyAdminPermission`](/api/admin-core/src/type-aliases/journeyadminpermission/)[]

---

### samples

> **samples**: readonly `object`[]

---

### scopeKey

> **scopeKey**: `string`

Change this key when the authenticated scope changes.

---

### state

> **state**: [`JourneyAdminState`](/api/admin-core/src/type-aliases/journeyadminstate/)

## Methods

### onCommand()

> **onCommand**(`command`): `Promise`\<[`JourneyEpisodeView`](/api/admin-core/src/type-aliases/journeyepisodeview/)\>

#### Parameters

##### command

[`JourneyAdminCommand`](/api/admin-core/src/type-aliases/journeyadmincommand/)

#### Returns

`Promise`\<[`JourneyEpisodeView`](/api/admin-core/src/type-aliases/journeyepisodeview/)\>

---

### onDryRun()

> **onDryRun**(`definition`, `sampleId`): `Promise`\<`Readonly`\<\{ `steps`: readonly `object`[]; \}\>\>

#### Parameters

##### definition

[`JourneyDefinition`](/api/lifecycle-core/src/type-aliases/journeydefinition/)

##### sampleId

`string`

#### Returns

`Promise`\<`Readonly`\<\{ `steps`: readonly `object`[]; \}\>\>
