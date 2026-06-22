---
editUrl: false
next: false
prev: false
title: "ClerkAuthDiagnosticsProvider"
---

Clerk 인증 readiness diagnostics provider입니다.

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new ClerkAuthDiagnosticsProvider**(`config`, `options?`): `ClerkAuthDiagnosticsProvider`

#### Parameters

##### config

[`ClerkAuthDiagnosticsConfig`](/api/auth-clerk/src/type-aliases/clerkauthdiagnosticsconfig/)

##### options?

[`ClerkAuthDiagnosticsOptions`](/api/auth-clerk/src/type-aliases/clerkauthdiagnosticsoptions/) = `{}`

#### Returns

`ClerkAuthDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"auth-clerk"` = `"auth-clerk"`

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
