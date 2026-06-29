---
editUrl: false
next: false
prev: false
title: "PolarBillingDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new PolarBillingDiagnosticsProvider**(`config`, `options?`): `PolarBillingDiagnosticsProvider`

#### Parameters

##### config

`Partial`\<[`PolarConfig`](/api/billing-polar/src/type-aliases/polarconfig/)\>

##### options?

[`PolarBillingDiagnosticsOptions`](/api/billing-polar/src/type-aliases/polarbillingdiagnosticsoptions/) = `{}`

#### Returns

`PolarBillingDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"billing-polar"` = `"billing-polar"`

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
