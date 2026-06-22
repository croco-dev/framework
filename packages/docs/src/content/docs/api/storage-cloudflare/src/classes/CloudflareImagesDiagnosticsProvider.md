---
editUrl: false
next: false
prev: false
title: "CloudflareImagesDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new CloudflareImagesDiagnosticsProvider**(`config`, `options?`): `CloudflareImagesDiagnosticsProvider`

#### Parameters

##### config

`Partial`\<[`CloudflareImagesOptions`](/api/storage-cloudflare/src/type-aliases/cloudflareimagesoptions/)\>

##### options?

[`CloudflareImagesDiagnosticsOptions`](/api/storage-cloudflare/src/type-aliases/cloudflareimagesdiagnosticsoptions/) = `{}`

#### Returns

`CloudflareImagesDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"storage-cloudflare"` = `"storage-cloudflare"`

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
