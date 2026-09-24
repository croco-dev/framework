---
editUrl: false
next: false
prev: false
title: "RuntimeContainer"
---

Croco runtime 컨테이너 인스턴스 타입입니다.

## Example

```typescript
import { ContainerInstance } from "@croco/framework-context";

function setup(container: ContainerInstance) {
  container.set("key", value);
}
```

## Constructors

### Constructor

> **new RuntimeContainer**(): `RuntimeContainer`

#### Returns

`RuntimeContainer`

## Accessors

### handlers

#### Get Signature

> **get** `static` **handlers**(): readonly `never`[]

##### Returns

readonly `never`[]

---

### instances

#### Get Signature

> **get** `static` **instances**(): readonly [`ContainerInstance`](/api/framework-context/src/classes/containerinstance/)[]

##### Returns

readonly [`ContainerInstance`](/api/framework-context/src/classes/containerinstance/)[]

## Methods

### get()

> `static` **get**\<`T`\>(`identifier`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

#### Returns

`T`

---

### getMany()

> `static` **getMany**\<`T`\>(`identifier`): `T`[]

#### Type Parameters

##### T

`T`

#### Parameters

##### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

#### Returns

`T`[]

---

### has()

> `static` **has**\<`T`\>(`identifier`): `boolean`

#### Type Parameters

##### T

`T`

#### Parameters

##### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

#### Returns

`boolean`

---

### of()

> `static` **of**(`id?`): [`ContainerInstance`](/api/framework-context/src/classes/containerinstance/)

#### Parameters

##### id?

`string` = `"default"`

#### Returns

[`ContainerInstance`](/api/framework-context/src/classes/containerinstance/)

---

### remove()

> `static` **remove**\<`T`\>(`identifier`): _typeof_ `RuntimeContainer`

#### Type Parameters

##### T

`T`

#### Parameters

##### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

#### Returns

_typeof_ `RuntimeContainer`

---

### reset()

> `static` **reset**(`id?`): _typeof_ `RuntimeContainer`

#### Parameters

##### id?

`string`

#### Returns

_typeof_ `RuntimeContainer`

---

### set()

#### Call Signature

> `static` **set**\<`T`\>(`options`): _typeof_ `RuntimeContainer`

##### Type Parameters

###### T

`T`

##### Parameters

###### options

[`ServiceOptions`](/api/framework-context/src/type-aliases/serviceoptions/)\<`T`\>

##### Returns

_typeof_ `RuntimeContainer`

#### Call Signature

> `static` **set**\<`T`\>(`identifier`, `value`): _typeof_ `RuntimeContainer`

##### Type Parameters

###### T

`T`

##### Parameters

###### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

###### value

`T`

##### Returns

_typeof_ `RuntimeContainer`
