---
editUrl: false
next: false
prev: false
title: "normalizeAutoInstrumentationConfig"
---

> **normalizeAutoInstrumentationConfig**(`config`, `environment`): `Required`\<`Pick`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>\> & `Omit`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:111](https://github.com/croco-dev/framework/blob/f424c308c28377c4af3b393f40504d808c3cb4a4/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L111)

Creates a safe auto-instrumentation configuration.
Filters out unavailable modules and applies defaults.

## Parameters

### config

User-provided configuration

[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/) | `undefined`

### environment

Target environment ('lambda' | 'node')

`"lambda"` | `"node"`

## Returns

`Required`\<`Pick`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>\> & `Omit`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>

Normalized configuration
