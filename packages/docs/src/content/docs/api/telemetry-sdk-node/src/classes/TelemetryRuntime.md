---
editUrl: false
next: false
prev: false
title: "TelemetryRuntime"
---

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:8](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/runtime.ts#L8)

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

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:75](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/runtime.ts#L75)

#### Returns

`Promise`\<`void`\>

***

### getConfig()

> **getConfig**(): [`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:102](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/runtime.ts#L102)

#### Returns

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/) \| `null`

***

### init()

> **init**(`config`): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:24](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/runtime.ts#L24)

#### Parameters

##### config

[`TelemetryConfig`](/api/telemetry-sdk-node/src/type-aliases/telemetryconfig/)

#### Returns

`Promise`\<`void`\>

***

### isInitialized()

> **isInitialized**(): `boolean`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:98](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/runtime.ts#L98)

#### Returns

`boolean`

***

### shutdown()

> **shutdown**(): `Promise`\<`void`\>

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:85](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/runtime.ts#L85)

#### Returns

`Promise`\<`void`\>

***

### getInstance()

> `static` **getInstance**(): `TelemetryRuntime`

Defined in: [packages/telemetry-sdk-node/src/runtime.ts:17](https://github.com/croco-dev/shared/blob/e527eda2a2bdade5e61e156787935d7ae66c2fea/packages/telemetry-sdk-node/src/runtime.ts#L17)

#### Returns

`TelemetryRuntime`
