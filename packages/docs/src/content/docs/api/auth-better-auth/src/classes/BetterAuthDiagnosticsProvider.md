---
editUrl: false
next: false
prev: false
title: "BetterAuthDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new BetterAuthDiagnosticsProvider**(`config`, `options?`): `BetterAuthDiagnosticsProvider`

#### Parameters

##### config

[`BetterAuthDiagnosticsConfig`](/api/auth-better-auth/src/type-aliases/betterauthdiagnosticsconfig/)

##### options?

[`BetterAuthDiagnosticsOptions`](/api/auth-better-auth/src/type-aliases/betterauthdiagnosticsoptions/) = `{}`

#### Returns

`BetterAuthDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"auth-better-auth"` = `"auth-better-auth"`

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
