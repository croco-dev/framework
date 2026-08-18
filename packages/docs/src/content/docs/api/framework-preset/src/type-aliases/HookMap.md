---
editUrl: false
next: false
prev: false
title: "HookMap"
---

> **HookMap** = `object`

## Properties

### build:after?

> `readonly` `optional` **build:after?**: (`result`) => `Promise`\<`void`\> \| `void`

#### Parameters

##### result

###### outputDir

`string`

###### success

`boolean`

#### Returns

`Promise`\<`void`\> \| `void`

---

### build:before?

> `readonly` `optional` **build:before?**: (`config`) => `Promise`\<[`CrocoPresetConfig`](/api/framework-preset/src/type-aliases/crocopresetconfig/)\> \| [`CrocoPresetConfig`](/api/framework-preset/src/type-aliases/crocopresetconfig/)

#### Parameters

##### config

[`CrocoPresetConfig`](/api/framework-preset/src/type-aliases/crocopresetconfig/)

#### Returns

`Promise`\<[`CrocoPresetConfig`](/api/framework-preset/src/type-aliases/crocopresetconfig/)\> \| [`CrocoPresetConfig`](/api/framework-preset/src/type-aliases/crocopresetconfig/)

---

### dev:start?

> `readonly` `optional` **dev:start?**: () => `Promise`\<`void`\> \| `void`

#### Returns

`Promise`\<`void`\> \| `void`
