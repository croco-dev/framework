---
editUrl: false
next: false
prev: false
title: "ModuleContext"
---

## Constructors

### Constructor

> **new ModuleContext**(`container`, `options?`): `ModuleContext`

#### Parameters

##### container

[`ContainerInstance`](/api/framework-context/src/classes/containerinstance/)

##### options?

`ModuleContextOptions` = `{}`

#### Returns

`ModuleContext`

## Methods

### get()

> **get**\<`T`\>(`token`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`ModuleToken`](/api/framework-module/src/type-aliases/moduletoken/)\<`T`\>

#### Returns

`T`

---

### set()

> **set**\<`T`\>(`token`, `value`): `void`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`ModuleToken`](/api/framework-module/src/type-aliases/moduletoken/)\<`T`\>

##### value

`T`

#### Returns

`void`
