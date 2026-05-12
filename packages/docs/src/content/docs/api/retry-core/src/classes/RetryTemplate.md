---
editUrl: false
next: false
prev: false
title: "RetryTemplate"
---

Programmatic retry template.

## Example

```typescript
const template = new RetryTemplate({ maxAttempts: 3 });
const result = await template.execute(
  async (ctx) => await riskyOperation(),
  async (ctx) => fallbackValue,
);
```

## Constructors

### Constructor

> **new RetryTemplate**(`options?`): `RetryTemplate`

#### Parameters

##### options?

[`RetryTemplateOptions`](/api/retry-core/src/interfaces/retrytemplateoptions/) = `{}`

#### Returns

`RetryTemplate`

## Methods

### execute()

> **execute**\<`T`\>(`callback`, `recovery?`): `Promise`\<`T`\>

Execute operation with retry logic.

#### Type Parameters

##### T

`T`

#### Parameters

##### callback

[`RetryCallback`](/api/retry-core/src/type-aliases/retrycallback/)\<`T`\>

The operation to retry

##### recovery?

[`RecoveryCallback`](/api/retry-core/src/type-aliases/recoverycallback/)\<`T`\>

Optional recovery callback for exhausted retries

#### Returns

`Promise`\<`T`\>

Result of callback or recovery
