---
editUrl: false
next: false
prev: false
title: "RetryTemplate"
---

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:50](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/retry-core/src/libs/RetryTemplate.ts#L50)

Programmatic retry template.

## Example

```typescript
const template = new RetryTemplate({ maxAttempts: 3 });
const result = await template.execute(
  async (ctx) => await riskyOperation(),
  async (ctx) => fallbackValue
);
```

## Constructors

### Constructor

> **new RetryTemplate**(`options?`): `RetryTemplate`

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:57](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/retry-core/src/libs/RetryTemplate.ts#L57)

#### Parameters

##### options?

[`RetryTemplateOptions`](/api/retry-core/src/interfaces/retrytemplateoptions/) = `{}`

#### Returns

`RetryTemplate`

## Methods

### execute()

> **execute**\<`T`\>(`callback`, `recovery?`): `Promise`\<`T`\>

Defined in: [packages/retry-core/src/libs/RetryTemplate.ts:83](https://github.com/croco-dev/shared/blob/dbd54c8f608d8b724372129dd3d92924b60cf720/packages/retry-core/src/libs/RetryTemplate.ts#L83)

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
