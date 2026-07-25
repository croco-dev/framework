---
editUrl: false
next: false
prev: false
title: "TestKernelOptions"
---

> **TestKernelOptions** = `object`

## Properties

### adapter?

> `readonly` `optional` **adapter?**: [`TestKernelRuntime`](/api/testing/src/type-aliases/testkernelruntime/)

***

### baseUrl?

> `readonly` `optional` **baseUrl?**: `string`

***

### bootstrap

> `readonly` **bootstrap**: (`context`) => `Promise`\<`TestKernelBootstrapResult`\> \| `TestKernelBootstrapResult`

#### Parameters

##### context

[`TestKernelBootstrapContext`](/api/testing/src/type-aliases/testkernelbootstrapcontext/)

#### Returns

`Promise`\<`TestKernelBootstrapResult`\> \| `TestKernelBootstrapResult`

***

### dispose?

> `readonly` `optional` **dispose?**: (`app`) => `Promise`\<`void`\> \| `void`

#### Parameters

##### app

[`CrocoApp`](/api/transports-http/src/classes/crocoapp/)

#### Returns

`Promise`\<`void`\> \| `void`

***

### fidelity

> `readonly` **fidelity**: [`TestKernelBootFidelity`](/api/testing/src/type-aliases/testkernelbootfidelity/)

***

### validation?

> `readonly` `optional` **validation?**: `Partial`\<[`BootstrapValidationPolicy`](/api/transports-http/src/type-aliases/bootstrapvalidationpolicy/)\>
