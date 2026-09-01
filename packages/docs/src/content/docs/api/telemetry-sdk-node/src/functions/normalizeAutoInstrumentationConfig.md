---
editUrl: false
next: false
prev: false
title: "normalizeAutoInstrumentationConfig"
---

> **normalizeAutoInstrumentationConfig**(`config`, `environment`): `Required`\<`Pick`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>\> & `Omit`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>

Creates a safe auto-instrumentation configuration.
Filters out unavailable modules and applies defaults.

## Parameters

### config

[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/) \| `undefined`

User-provided configuration

### environment

`"lambda"` \| `"node"`

Target environment ('lambda' | 'node')

## Returns

`Required`\<`Pick`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>\> & `Omit`\<[`AutoInstrumentationConfig`](/api/telemetry-sdk-node/src/interfaces/autoinstrumentationconfig/), `"enabled"`\>

Normalized configuration
