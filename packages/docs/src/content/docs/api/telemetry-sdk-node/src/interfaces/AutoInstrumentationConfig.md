---
editUrl: false
next: false
prev: false
title: "AutoInstrumentationConfig"
---

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:45](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L45)

Configuration for auto-instrumentation.
Defines which modules should be automatically instrumented.

## Example

```typescript
const autoInstrumentConfig: AutoInstrumentationConfig = {
  enabled: true,
  modules: ['http', 'express', 'pg'],
  exclude: ['http.server.request'], // Exclude specific operations
};
```

## Properties

### customInstrumentations?

> `optional` **customInstrumentations**: `Instrumentation`\<`InstrumentationConfig`\>[]

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:68](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L68)

Custom instrumentation instances to include.
These are merged with auto-loaded instrumentations.

***

### enabled?

> `optional` **enabled**: `boolean`

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:50](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L50)

Whether auto-instrumentation is enabled.

#### Default

```ts
true
```

***

### exclude?

> `optional` **exclude**: `string`[]

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:81](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L81)

Patterns for operation names to exclude.
Supports simple wildcards with '*'.

#### Example

```ts
['health.check', 'metrics.*']
```

***

### excludeModules?

> `optional` **excludeModules**: [`AutoInstrumentationModule`](/api/telemetry-sdk-node/src/type-aliases/autoinstrumentationmodule/)[]

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:62](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L62)

List of modules to exclude from auto-instrumentation.
Takes precedence over 'modules'.

***

### include?

> `optional` **include**: `string`[]

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:88](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L88)

Patterns for operation names to include (whitelist).
If specified, only matching operations are instrumented.

#### Example

```ts
['api.*', 'service.*']
```

***

### moduleOptions?

> `optional` **moduleOptions**: `Record`\<`string`, `Record`\<`string`, `unknown`\>\>

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:74](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L74)

Configuration for specific instrumentations.
Keys are module names, values are module-specific options.

***

### modules?

> `optional` **modules**: [`AutoInstrumentationModule`](/api/telemetry-sdk-node/src/type-aliases/autoinstrumentationmodule/)[]

Defined in: [packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts:56](https://github.com/croco-dev/framework/blob/8835d7e83812726201ce484d8ae1219da2389062/packages/telemetry-sdk-node/src/libs/instrumentation/AutoInstrumentation.ts#L56)

List of modules to auto-instrument.
If not specified, all available modules will be instrumented.
