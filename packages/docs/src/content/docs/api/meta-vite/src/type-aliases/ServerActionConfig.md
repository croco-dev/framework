---
editUrl: false
next: false
prev: false
title: "ServerActionConfig"
---

> **ServerActionConfig**\<`TInput`, `TOutput`, `TProblemCode`\> = `object`

Server Action configuration.

## Example

```ts
createServerAction({
  name: 'submit-form',
  schema: z.object({ email: z.string().email(), name: z.string() }),
  handler: async (data, context) => {
    // context may be undefined
    return new Response(JSON.stringify({ success: true }), { status: 200 });
  },
});
```

## Type Parameters

### TInput

`TInput` = `unknown`

### TOutput

`TOutput` = `unknown`

### TProblemCode

`TProblemCode` *extends* `string` = `string`

## Properties

### handler

> **handler**: (`data`, `context?`) => `Promise`\<[`ServerActionHandlerResult`](/api/meta-vite/src/type-aliases/serveractionhandlerresult/)\<`TOutput`\>\> \| [`ServerActionHandlerResult`](/api/meta-vite/src/type-aliases/serveractionhandlerresult/)\<`TOutput`\>

Action handler receiving parsed/validated data and optional runtime context

#### Parameters

##### data

`TInput`

##### context?

[`RuntimeContext`](/api/meta-vite/src/type-aliases/runtimecontext/)

#### Returns

`Promise`\<[`ServerActionHandlerResult`](/api/meta-vite/src/type-aliases/serveractionhandlerresult/)\<`TOutput`\>\> \| [`ServerActionHandlerResult`](/api/meta-vite/src/type-aliases/serveractionhandlerresult/)\<`TOutput`\>

***

### invalidates?

> `optional` **invalidates?**: readonly [`FrontendActionInvalidationHint`](/api/presentation-preset/src/type-aliases/frontendactioninvalidationhint/)[]

Optional frontend cache invalidation hints emitted to the frontend action manifest

***

### name

> **name**: `string`

Unique identifier for this action

***

### output?

> `optional` **output?**: [`ServerActionOutputContract`](/api/meta-vite/src/type-aliases/serveractionoutputcontract/)\<`TOutput`\>

Optional output contract metadata for codegen and documentation

***

### problems?

> `optional` **problems?**: readonly [`ServerActionProblemContract`](/api/meta-vite/src/type-aliases/serveractionproblemcontract/)\<`TProblemCode`\>[]

Optional declared domain Problems that the handler can surface

***

### schema?

> `optional` **schema?**: `ZodSchema`\<`TInput`\>

Optional Zod schema for input validation
