---
editUrl: false
next: false
prev: false
title: "CrocoCommandDependencies"
---

> **CrocoCommandDependencies** = `object`

## Properties

### cwd?

> `readonly` `optional` **cwd?**: `string`

---

### env?

> `readonly` `optional` **env?**: `Readonly`\<`Record`\<`string`, `string` \| `undefined`\>\>

---

### isTTY?

> `readonly` `optional` **isTTY?**: `boolean`

---

### stderr?

> `readonly` `optional` **stderr?**: (`message`) => `void`

#### Parameters

##### message

`string`

#### Returns

`void`

---

### stdout?

> `readonly` `optional` **stdout?**: (`message`) => `void`

#### Parameters

##### message

`string`

#### Returns

`void`
