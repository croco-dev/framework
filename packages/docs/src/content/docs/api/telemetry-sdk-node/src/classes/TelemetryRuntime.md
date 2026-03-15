---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:8](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/runtime.ts#L8)

OpenTelemetry SDK runtime manager.

## Remarks

Singleton class that manages the OpenTelemetry SDK lifecycle.
Use [getInstance](/api/telemetry-sdk-node/src/classes/telemetryruntime/#getinstance) to get the singleton instance, then call [init](/api/telemetry-sdk-node/src/classes/telemetryruntime/#init)
to initialize the SDK with your configuration.

In Lambda environments, call [forceFlush](/api/telemetry-sdk-node/src/classes/telemetryruntime/#forceflush) before returning from the handler
to ensure all telemetry data is exported.

## Example

```ts
import { TelemetryRuntime, lambdaPreset } from '@croco/telemetry-sdk-node';

// Get singleton instance (usually at module scope)
const telemetry = TelemetryRuntime.getInstance();

// Initialize once at application startup
await telemetry.init(lambdaPreset({
  serviceName: 'my-service',
}));

// In Lambda handler, flush before returning
export const handler = async (event: any) => {
  try {
    return await processEvent(event);
  } finally {
    await telemetry.forceFlush();
  }
};
```

## Methods

### forceFlush()

> **forceFlush**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:86](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/runtime.ts#L86)

#### Returns

`Promise`\<`void`\>

***

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:117](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/runtime.ts#L117)

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

***

### init()

> **init**(`config`): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:29](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/runtime.ts#L29)

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:113](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/runtime.ts#L113)

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:98](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/runtime.ts#L98)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:22](https://github.com/croco-dev/framework/blob/dfdc13c04d1ec41944df1d6a5c5701779b83d710/packages/telemetry-sdk-node/src/runtime.ts#L22)

#### Returns

`TelemetryRuntime`
