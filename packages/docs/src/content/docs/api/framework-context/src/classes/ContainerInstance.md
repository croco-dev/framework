---
editUrl: false
next: false
prev: false
title: "ContainerInstance"
---

TypeDI can have multiple containers.
One container is ContainerInstance.

## Constructors

### Constructor

> **new ContainerInstance**(`id`): `ContainerInstance`

#### Parameters

##### id

`string`

#### Returns

`ContainerInstance`

## Properties

### id

> `readonly` **id**: `string`

Container instance id.

## Methods

### get()

#### Call Signature

> **get**\<`T`\>(`type`): `T`

Retrieves the service with given name or type from the service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### type

`Constructable`\<`T`\>

##### Returns

`T`

#### Call Signature

> **get**\<`T`\>(`type`): `T`

Retrieves the service with given name or type from the service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### type

`AbstractConstructable`\<`T`\>

##### Returns

`T`

#### Call Signature

> **get**\<`T`\>(`id`): `T`

Retrieves the service with given name or type from the service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

`string`

##### Returns

`T`

#### Call Signature

> **get**\<`T`\>(`id`): `T`

Retrieves the service with given name or type from the service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

[`Token`](/api/framework-context/src/classes/token/)\<`T`\>

##### Returns

`T`

#### Call Signature

> **get**\<`T`\>(`id`): `T`

Retrieves the service with given name or type from the service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

`ServiceIdentifier`\<`T`\>

##### Returns

`T`

---

### getMany()

#### Call Signature

> **getMany**\<`T`\>(`type`): `T`[]

Gets all instances registered in the container of the given service identifier.
Used when service defined with multiple: true flag.

##### Type Parameters

###### T

`T`

##### Parameters

###### type

`Constructable`\<`T`\>

##### Returns

`T`[]

#### Call Signature

> **getMany**\<`T`\>(`type`): `T`[]

Gets all instances registered in the container of the given service identifier.
Used when service defined with multiple: true flag.

##### Type Parameters

###### T

`T`

##### Parameters

###### type

`AbstractConstructable`\<`T`\>

##### Returns

`T`[]

#### Call Signature

> **getMany**\<`T`\>(`id`): `T`[]

Gets all instances registered in the container of the given service identifier.
Used when service defined with multiple: true flag.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

`string`

##### Returns

`T`[]

#### Call Signature

> **getMany**\<`T`\>(`id`): `T`[]

Gets all instances registered in the container of the given service identifier.
Used when service defined with multiple: true flag.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

[`Token`](/api/framework-context/src/classes/token/)\<`T`\>

##### Returns

`T`[]

#### Call Signature

> **getMany**\<`T`\>(`id`): `T`[]

Gets all instances registered in the container of the given service identifier.
Used when service defined with multiple: true flag.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

`ServiceIdentifier`\<`T`\>

##### Returns

`T`[]

---

### has()

#### Call Signature

> **has**\<`T`\>(`type`): `boolean`

Checks if the service with given name or type is registered service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### type

`Constructable`\<`T`\>

##### Returns

`boolean`

#### Call Signature

> **has**\<`T`\>(`id`): `boolean`

Checks if the service with given name or type is registered service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

`string`

##### Returns

`boolean`

#### Call Signature

> **has**\<`T`\>(`id`): `boolean`

Checks if the service with given name or type is registered service container.
Optionally, parameters can be passed in case if instance is initialized in the container for the first time.

##### Type Parameters

###### T

`T`

##### Parameters

###### id

[`Token`](/api/framework-context/src/classes/token/)\<`T`\>

##### Returns

`boolean`

---

### remove()

> **remove**(`identifierOrIdentifierArray`): `this`

Removes services with a given service identifiers.

#### Parameters

##### identifierOrIdentifierArray

`ServiceIdentifier` | `ServiceIdentifier`[]

#### Returns

`this`

---

### reset()

> **reset**(`options?`): `this`

Completely resets the container by removing all previously registered services from it.

#### Parameters

##### options?

###### strategy

`"resetValue"` \| `"resetServices"`

#### Returns

`this`

---

### set()

#### Call Signature

> **set**\<`T`\>(`service`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### service

`ServiceMetadata`\<`T`\>

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`type`, `instance`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### type

`Constructable`\<`T`\>

###### instance

`T`

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`type`, `instance`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### type

`AbstractConstructable`\<`T`\>

###### instance

`T`

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`name`, `instance`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### name

`string`

###### instance

`T`

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`token`, `instance`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### token

[`Token`](/api/framework-context/src/classes/token/)\<`T`\>

###### instance

`T`

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`token`, `instance`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### token

`ServiceIdentifier`

###### instance

`T`

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`metadata`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### metadata

`ServiceOptions`\<`T`\>

##### Returns

`this`

#### Call Signature

> **set**\<`T`\>(`metadataArray`): `this`

Sets a value for the given type or service name in the container.

##### Type Parameters

###### T

`T` = `unknown`

##### Parameters

###### metadataArray

`ServiceOptions`\<`T`\>[]

##### Returns

`this`
