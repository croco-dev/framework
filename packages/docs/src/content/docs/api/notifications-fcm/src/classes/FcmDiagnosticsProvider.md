---
editUrl: false
next: false
prev: false
title: "FcmDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new FcmDiagnosticsProvider**(`config`, `options?`): `FcmDiagnosticsProvider`

#### Parameters

##### config

[`FcmConfig`](/api/notifications-fcm/src/type-aliases/fcmconfig/)

##### options?

[`FcmDiagnosticsOptions`](/api/notifications-fcm/src/type-aliases/fcmdiagnosticsoptions/) = `{}`

#### Returns

`FcmDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"notifications-fcm"` = `"notifications-fcm"`

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
