---
editUrl: false
next: false
prev: false
title: "TelemetryDiagnosticsProvider"
---

## Implements

- [`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/)

## Constructors

### Constructor

> **new TelemetryDiagnosticsProvider**(`options?`): `TelemetryDiagnosticsProvider`

#### Parameters

##### options?

[`TelemetryDiagnosticsProviderOptions`](/api/telemetry-sdk-node/src/type-aliases/telemetrydiagnosticsprovideroptions/) = `{}`

#### Returns

`TelemetryDiagnosticsProvider`

## Properties

### name

> `readonly` **name**: `"telemetry"` = `"telemetry"`

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`name`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#name)

## Methods

### getHealth()

> **getHealth**(): `Promise`\<[`TelemetryDiagnosticsHealthStatus`](/api/telemetry-sdk-node/src/type-aliases/telemetrydiagnosticshealthstatus/)\>

#### Returns

`Promise`\<[`TelemetryDiagnosticsHealthStatus`](/api/telemetry-sdk-node/src/type-aliases/telemetrydiagnosticshealthstatus/)\>

#### Implementation of

[`DiagnosticsProvider`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/).[`getHealth`](/api/diagnostics-core/src/interfaces/diagnosticsprovider/#gethealth)
