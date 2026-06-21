---
editUrl: false
next: false
prev: false
title: "CloudinaryDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new CloudinaryDiagnosticsProvider**(`config`, `options?`): `CloudinaryDiagnosticsProvider`

#### Parameters

##### config

`Partial`\<[`CloudinaryConfig`](/api/storage-cloudinary/src/type-aliases/cloudinaryconfig/)\>

##### options?

[`CloudinaryDiagnosticsOptions`](/api/storage-cloudinary/src/type-aliases/cloudinarydiagnosticsoptions/) = `{}`

#### Returns

`CloudinaryDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"storage-cloudinary"` = `"storage-cloudinary"`

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
