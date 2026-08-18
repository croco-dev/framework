---
editUrl: false
next: false
prev: false
title: "TriggerRegistry"
---

Registry for trigger metadata.
Uses MetadataStorage to store trigger configurations.

## Methods

### getAllTriggers()

> **getAllTriggers**(): `Map`\<`object`, `Map`\<`string` \| `symbol`, [`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)\>\>

#### Returns

`Map`\<`object`, `Map`\<`string` \| `symbol`, [`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)\>\>

---

### getTriggers()

> **getTriggers**(`target`): `Map`\<`string` \| `symbol`, [`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)\>

#### Parameters

##### target

`object`

#### Returns

`Map`\<`string` \| `symbol`, [`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)\>

---

### getTriggersByType()

> **getTriggersByType**\<`T`\>(`target`, `type`): `Map`\<`string` \| `symbol`, [`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)\>

#### Type Parameters

##### T

`T` _extends_ [`TriggerType`](/api/triggers-core/src/type-aliases/triggertype/)

#### Parameters

##### target

`object`

##### type

`T`

#### Returns

`Map`\<`string` \| `symbol`, [`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)\>

---

### register()

> **register**(`metadata`): `void`

#### Parameters

##### metadata

[`AnyTriggerMetadata`](/api/triggers-core/src/type-aliases/anytriggermetadata/)

#### Returns

`void`

---

### getInstance()

> `static` **getInstance**(): `TriggerRegistry`

#### Returns

`TriggerRegistry`
