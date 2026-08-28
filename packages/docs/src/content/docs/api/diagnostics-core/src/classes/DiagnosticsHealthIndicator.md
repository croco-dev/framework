---
editUrl: false
next: false
prev: false
title: "DiagnosticsHealthIndicator"
---

Adapts one diagnostics provider to the health readiness indicator contract.

## Constructors

### Constructor

> **new DiagnosticsHealthIndicator**(`provider`, `policy`): `DiagnosticsHealthIndicator`

#### Parameters

##### provider

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

##### policy

[`DiagnosticsHealthIndicatorPolicy`](/api/diagnostics-core/src/type-aliases/diagnosticshealthindicatorpolicy/)

#### Returns

`DiagnosticsHealthIndicator`

## Properties

### name

> `readonly` **name**: `string`

## Methods

### check()

> **check**(`signal?`): `Promise`\<`ReadinessResult`\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`ReadinessResult`\>

---

### isReady()

> **isReady**(`signal?`): `Promise`\<`ReadinessResult`\>

#### Parameters

##### signal?

`AbortSignal`

#### Returns

`Promise`\<`ReadinessResult`\>
