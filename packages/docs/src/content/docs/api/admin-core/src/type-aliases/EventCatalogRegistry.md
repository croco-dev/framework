---
editUrl: false
next: false
prev: false
title: "EventCatalogRegistry"
---

> **EventCatalogRegistry** = `object`

## Methods

### getDescriptor()

> **getDescriptor**(`name`, `version`): [`EventCatalogDescriptor`](/api/admin-core/src/type-aliases/eventcatalogdescriptor/) \| `undefined`

#### Parameters

##### name

`string`

##### version

`number`

#### Returns

[`EventCatalogDescriptor`](/api/admin-core/src/type-aliases/eventcatalogdescriptor/) \| `undefined`

---

### getObservation()

> **getObservation**(`scope`, `name`, `version`): [`EventCatalogObservation`](/api/admin-core/src/type-aliases/eventcatalogobservation/)

#### Parameters

##### scope

[`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/)

##### name

`string`

##### version

`number`

#### Returns

[`EventCatalogObservation`](/api/admin-core/src/type-aliases/eventcatalogobservation/)

---

### listDescriptors()

> **listDescriptors**(): readonly [`EventCatalogDescriptor`](/api/admin-core/src/type-aliases/eventcatalogdescriptor/)[]

#### Returns

readonly [`EventCatalogDescriptor`](/api/admin-core/src/type-aliases/eventcatalogdescriptor/)[]

---

### validatePayload()

> **validatePayload**(`name`, `version`, `payload`): \{ `status`: `"valid"`; \} \| \{ `code`: `string`; `status`: `"invalid"`; \}

#### Parameters

##### name

`string`

##### version

`number`

##### payload

`unknown`

#### Returns

\{ `status`: `"valid"`; \} \| \{ `code`: `string`; `status`: `"invalid"`; \}
