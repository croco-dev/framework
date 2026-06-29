---
editUrl: false
next: false
prev: false
title: "LifecycleDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new LifecycleDiagnosticsProvider**(`runStore`, `options?`): `LifecycleDiagnosticsProvider`

#### Parameters

##### runStore

[`LifecycleRunStore`](/api/lifecycle-core/src/interfaces/lifecyclerunstore/)

##### options?

`LifecycleDiagnosticsProviderOptions` = `{}`

#### Returns

`LifecycleDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"lifecycle"` = `"lifecycle"`

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`name`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#name)

## Methods

### getHealth()

> **getHealth**(`_signal?`): `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Parameters

##### \_signal?

`AbortSignal`

#### Returns

`Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`getHealth`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#gethealth)
