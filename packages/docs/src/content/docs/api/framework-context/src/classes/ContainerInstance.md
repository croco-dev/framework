---
editUrl: false
next: false
prev: false
title: "ContainerInstance"
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

> **new ContainerInstance**(`id?`): `ContainerInstance`

#### Parameters

##### id?

`string` = `"default"`

#### Returns

`ContainerInstance`

## Properties

### id

> `readonly` **id**: `string` = `"default"`

---

### services

> `readonly` **services**: [`ServiceMetadata`](/api/framework-context/src/type-aliases/servicemetadata/)\<`unknown`\>[] = `[]`

## Methods

### destroyServiceInstance()

> **destroyServiceInstance**(`service`, `disposedValues?`): `void`

#### Parameters

##### service

[`ServiceMetadata`](/api/framework-context/src/type-aliases/servicemetadata/)\<`unknown`\>

##### disposedValues?

`Set`\<`unknown`\>

#### Returns

`void`

---

### get()

> **get**\<`T`\>(`identifier`): `T`

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

> **getMany**\<`T`\>(`identifier`): `T`[]

#### Type Parameters

##### T

`T`

#### Parameters

##### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

#### Returns

`T`[]

---

### getServiceValue()

> **getServiceValue**\<`T`\>(`service`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### service

[`ServiceMetadata`](/api/framework-context/src/type-aliases/servicemetadata/)\<`T`\>

#### Returns

`T`

---

### has()

> **has**\<`T`\>(`identifier`): `boolean`

#### Type Parameters

##### T

`T`

#### Parameters

##### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

#### Returns

`boolean`

---

### remove()

> **remove**\<`T`\>(`identifier`): `this`

#### Type Parameters

##### T

`T`

#### Parameters

##### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

#### Returns

`this`

---

### reset()

> **reset**(`_options?`, `disposedValues?`): `this`

#### Parameters

##### \_options?

###### strategy?

`"resetServices"`

##### disposedValues?

`Set`\<`unknown`\> = `...`

#### Returns

`this`

---

### set()

#### Call Signature

> **set**\<`T`\>(`options`): `this`

##### Type Parameters

###### T

`T`

##### Parameters

###### options

[`ServiceOptions`](/api/framework-context/src/type-aliases/serviceoptions/)\<`T`\>

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`identifier`, `value`): `this`

##### Type Parameters

###### T

`T`

##### Parameters

###### identifier

[`ServiceIdentifier`](/api/framework-context/src/type-aliases/serviceidentifier/)\<`T`\>

###### value

`T`

##### Returns

`this`
