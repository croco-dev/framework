---
editUrl: false
next: false
prev: false
title: "TenantManagerRegistry"
---

Global registry for TenantManager instances.
Supports multiple managers with key-based lookup.

## Constructors

### Constructor

> **new TenantManagerRegistry**(`entries?`): `TenantManagerRegistry`

#### Parameters

##### entries?

`Iterable`\<readonly \[`string` \| `symbol`, [`TenantManager`](/api/tenant-core/src/classes/tenantmanager/)\], `any`, `any`\>

#### Returns

`TenantManagerRegistry`

## Methods

### clear()

> **clear**(): `void`

#### Returns

`void`

---

### get()

> **get**(`key?`): [`TenantManager`](/api/tenant-core/src/classes/tenantmanager/)

#### Parameters

##### key?

`string` \| `symbol`

#### Returns

[`TenantManager`](/api/tenant-core/src/classes/tenantmanager/)

---

### has()

> **has**(`key?`): `boolean`

#### Parameters

##### key?

`string` \| `symbol`

#### Returns

`boolean`

---

### register()

> **register**(`manager`, `key?`): `void`

#### Parameters

##### manager

[`TenantManager`](/api/tenant-core/src/classes/tenantmanager/)

##### key?

`string` \| `symbol`

#### Returns

`void`

---

### clear()

> `static` **clear**(): `void`

Clear all registered managers. Useful for testing.

#### Returns

`void`

---

### get()

> `static` **get**(`key?`): [`TenantManager`](/api/tenant-core/src/classes/tenantmanager/)

Get a registered TenantManager instance.

#### Parameters

##### key?

`string` \| `symbol`

#### Returns

[`TenantManager`](/api/tenant-core/src/classes/tenantmanager/)

#### Throws

Error if manager is not registered

---

### getInstance()

> `static` **getInstance**(): `TenantManagerRegistry`

#### Returns

`TenantManagerRegistry`

---

### has()

> `static` **has**(`key?`): `boolean`

Check if a TenantManager is registered.

#### Parameters

##### key?

`string` \| `symbol`

#### Returns

`boolean`

---

### register()

> `static` **register**(`manager`, `key?`): `void`

Register a TenantManager instance.

#### Parameters

##### manager

[`TenantManager`](/api/tenant-core/src/classes/tenantmanager/)

##### key?

`string` \| `symbol`

#### Returns

`void`
