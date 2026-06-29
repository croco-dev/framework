---
editUrl: false
next: false
prev: false
title: "ResendDiagnosticsProvider"
---

Resend readiness diagnostics provider입니다.

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new ResendDiagnosticsProvider**(`config`, `options?`): `ResendDiagnosticsProvider`

#### Parameters

##### config

`Partial`\<[`ResendConfig`](/api/notifications-resend/src/type-aliases/resendconfig/)\>

##### options?

[`ResendDiagnosticsOptions`](/api/notifications-resend/src/type-aliases/resenddiagnosticsoptions/) = `{}`

#### Returns

`ResendDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"notifications-resend"` = `"notifications-resend"`

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
