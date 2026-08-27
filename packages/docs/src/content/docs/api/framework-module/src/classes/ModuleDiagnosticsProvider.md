---
editUrl: false
next: false
prev: false
title: "ModuleDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new ModuleDiagnosticsProvider**(`runtime?`): `ModuleDiagnosticsProvider`

#### Parameters

##### runtime?

`Pick`\<[`ModuleRuntime`](/api/framework-module/src/interfaces/moduleruntime/), `"getRegisteredModules"`\> = `defaultModuleRuntime`

#### Returns

`ModuleDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"modules"` = `"modules"`

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`name`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#name)

## Methods

### getHealth()

> **getHealth**(): `Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Returns

`Promise`\<[`HealthStatus`](/api/diagnostics-core/src/type-aliases/healthstatus/)\>

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`getHealth`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#gethealth)
