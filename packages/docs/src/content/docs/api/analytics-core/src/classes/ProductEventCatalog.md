---
editUrl: false
next: false
prev: false
title: "ProductEventCatalog"
---

## Constructors

### Constructor

> **new ProductEventCatalog**(`definitions`, `manager?`, `diagnostics?`): `ProductEventCatalog`

#### Parameters

##### definitions

readonly [`ProductEventDefinition`](/api/analytics-core/src/type-aliases/producteventdefinition/)\<[`ProductEventObjectSchema`](/api/analytics-core/src/type-aliases/producteventobjectschema/)\>[]

##### manager?

###### captureValidatedEnvelope

##### diagnostics?

[`ProductEventDiagnosticsSink`](/api/analytics-core/src/interfaces/producteventdiagnosticssink/) = `...`

#### Returns

`ProductEventCatalog`

## Methods

### captureTyped()

> **captureTyped**\<`S`\>(`definition`, `payload`, `context`): [`CaptureResult`](/api/analytics-core/src/type-aliases/captureresult/)

#### Type Parameters

##### S

`S` _extends_ [`ProductEventObjectSchema`](/api/analytics-core/src/type-aliases/producteventobjectschema/)

#### Parameters

##### definition

[`ProductEventDefinition`](/api/analytics-core/src/type-aliases/producteventdefinition/)\<`S`\>

##### payload

[`ProductEventPayload`](/api/analytics-core/src/type-aliases/producteventpayload/)\<`S`\>

##### context

[`ProductEventContext`](/api/analytics-core/src/type-aliases/producteventcontext/)

#### Returns

[`CaptureResult`](/api/analytics-core/src/type-aliases/captureresult/)

---

### getDescriptor()

> **getDescriptor**(`name`, `version`): [`EventDescriptor`](/api/analytics-core/src/type-aliases/eventdescriptor/) \| `undefined`

#### Parameters

##### name

`string`

##### version

`number`

#### Returns

[`EventDescriptor`](/api/analytics-core/src/type-aliases/eventdescriptor/) \| `undefined`

---

### getObservation()

> **getObservation**(`scope`, `name`, `version`): [`EventObservation`](/api/analytics-core/src/type-aliases/eventobservation/)

#### Parameters

##### scope

[`ProductEventDiagnosticScope`](/api/analytics-core/src/type-aliases/producteventdiagnosticscope/)

##### name

`string`

##### version

`number`

#### Returns

[`EventObservation`](/api/analytics-core/src/type-aliases/eventobservation/)

---

### listDescriptors()

> **listDescriptors**(): readonly [`EventDescriptor`](/api/analytics-core/src/type-aliases/eventdescriptor/)[]

#### Returns

readonly [`EventDescriptor`](/api/analytics-core/src/type-aliases/eventdescriptor/)[]

---

### validatePayload()

> **validatePayload**(`name`, `version`, `payload`): [`ProductEventValidationResult`](/api/analytics-core/src/type-aliases/producteventvalidationresult/)

#### Parameters

##### name

`string`

##### version

`number`

##### payload

`unknown`

#### Returns

[`ProductEventValidationResult`](/api/analytics-core/src/type-aliases/producteventvalidationresult/)
