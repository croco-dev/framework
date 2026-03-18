---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:7](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L7)

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

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:114](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L114)

#### Returns

`Promise`\<`void`\>

***

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:153](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L153)

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

***

### init()

> **init**(`config`): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:43](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L43)

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:149](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L149)

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:126](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L126)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:36](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L36)

#### Returns

`TelemetryRuntime`

***

### reset()

> `static` **reset**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:141](https://github.com/croco-dev/framework/blob/7b8a1acf436b1287a1d68b6f5ed7382cf2d96a90/packages/telemetry-sdk-node/src/runtime.ts#L141)

#### Returns

`Promise`\<`void`\>
