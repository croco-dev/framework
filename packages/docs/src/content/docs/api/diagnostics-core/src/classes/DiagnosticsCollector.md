---
editUrl: false
next: false
prev: false
title: "DiagnosticsCollector"
---

## Constructors

### Constructor

> **new DiagnosticsCollector**(`options?`): `DiagnosticsCollector`

#### Parameters

##### options?

[`DiagnosticsCollectorOptions`](/api/diagnostics-core/src/type-aliases/diagnosticscollectoroptions/) = `{}`

#### Returns

`DiagnosticsCollector`

## Methods

### getProviders()

> **getProviders**(): readonly [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)[]

#### Returns

readonly [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)[]

---

### getReport()

> **getReport**(): `Promise`\<[`DiagnosticsReport`](/api/diagnostics-core/src/type-aliases/diagnosticsreport/)\>

#### Returns

`Promise`\<[`DiagnosticsReport`](/api/diagnostics-core/src/type-aliases/diagnosticsreport/)\>

---

### recordError()

> **recordError**(`error`): `void`

#### Parameters

##### error

[`ErrorRecord`](/api/diagnostics-core/src/type-aliases/errorrecord/)

#### Returns

`void`

---

### registerProvider()

> **registerProvider**(`provider`, `options?`): `void`

#### Parameters

##### provider

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

##### options?

[`DiagnosticsProviderOptions`](/api/diagnostics-core/src/type-aliases/diagnosticsprovideroptions/) = `{}`

#### Returns

`void`
