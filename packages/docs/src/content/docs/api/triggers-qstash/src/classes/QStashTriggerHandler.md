---
editUrl: false
next: false
prev: false
title: "QStashTriggerHandler"
---

QStashTriggerHandler handles incoming webhooks from QStash.

This handler:

- Verifies the QStash signature to ensure the request is authentic
- Parses the payload to identify the target class and method
- Resolves the target instance from the DI container
- Creates an execution via ExecutionManager
- Dispatches the execution to the target method

Usage with Hono (for Lambda):

```typescript
import { Hono } from "hono";
import { client, receiver } from "./qstash-config";
import { executionManager } from "./execution-config";
import {
  createQStashApiDeliveryIdentityVerifier,
  QStashTriggerHandler,
} from "@croco/triggers-qstash";

const app = new Hono();
const handler = new QStashTriggerHandler({
  receiver,
  deliveryIdentityVerifier: createQStashApiDeliveryIdentityVerifier(client),
  executionManager,
  executionTimeout: 60_000,
});

app.post("/webhooks/qstash", async (c) => {
  const body = await c.req.text();
  const signature = c.req.header("Upstash-Signature");

  const result = await handler.handle(body, signature, {
    messageId: c.req.header("Upstash-Message-Id") ?? "",
  });
  return c.json(result.body, result.statusCode);
});
```

## Constructors

### Constructor

> **new QStashTriggerHandler**(`options`): `QStashTriggerHandler`

#### Parameters

##### options

[`QStashTriggerHandlerOptions`](/api/triggers-qstash/src/type-aliases/qstashtriggerhandleroptions/)

#### Returns

`QStashTriggerHandler`

## Methods

### handle()

> **handle**(`body`, `signature`, `delivery`): `Promise`\<[`HandleResult`](/api/triggers-qstash/src/type-aliases/handleresult/)\>

Handle an incoming QStash webhook request.

#### Parameters

##### body

`string`

Raw request body as string

##### signature

`string` \| `undefined`

QStash signature from 'Upstash-Signature' header

##### delivery

[`QStashDeliveryIdentity`](/api/triggers-qstash/src/type-aliases/qstashdeliveryidentity/)

#### Returns

`Promise`\<[`HandleResult`](/api/triggers-qstash/src/type-aliases/handleresult/)\>

Handle result with status and response data

---

### createLambdaHandler()

> `static` **createLambdaHandler**(`options`): (`event`) => `Promise`\<\{ `body`: `string`; `statusCode`: `number`; \}\>

Create a Lambda handler wrapper for easy integration.

Usage:

```typescript
export const handler = createLambdaHandler({
  receiver: myReceiver,
  deliveryIdentityVerifier: createQStashApiDeliveryIdentityVerifier(myClient),
  executionManager: myExecutionManager,
  executionTimeout: 60_000,
});
```

#### Parameters

##### options

[`QStashTriggerHandlerOptions`](/api/triggers-qstash/src/type-aliases/qstashtriggerhandleroptions/)

#### Returns

(`event`) => `Promise`\<\{ `body`: `string`; `statusCode`: `number`; \}\>
