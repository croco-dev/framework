---
editUrl: false
next: false
prev: false
title: "R2StorageDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new R2StorageDiagnosticsProvider**(`config`, `options?`): `R2StorageDiagnosticsProvider`

#### Parameters

##### config

`Partial`\<[`R2Options`](/api/storage-r2/src/type-aliases/r2options/)\>

##### options?

[`R2StorageDiagnosticsOptions`](/api/storage-r2/src/type-aliases/r2storagediagnosticsoptions/) = `{}`

#### Returns

`R2StorageDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"storage-r2"` = `"storage-r2"`

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`name`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#name)

## Methods

### getHealth()

> **getHealth**(`signal?`): `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`getHealth`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#gethealth)
