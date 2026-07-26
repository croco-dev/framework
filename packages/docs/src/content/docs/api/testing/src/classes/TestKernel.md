---
editUrl: false
next: false
prev: false
title: "TestKernel"
---

## Implements

- `AsyncDisposable`

## Constructors

### Constructor

> **new TestKernel**(`app`, `fidelity`, `scope`, `transactionContext`, `baseUrl`, `lambdaHandler`, `nodeHandler`, `cleanupOperations`, `resourceConnections`, `resourceEvidenceBuffer`): `TestKernel`

#### Parameters

##### app

[`CrocoApp`](/api/transports-http/src/classes/crocoapp/)

##### fidelity

[`TestKernelFidelity`](/api/testing/src/type-aliases/testkernelfidelity/)

##### scope

[`ContainerScope`](/api/framework-context/src/classes/containerscope/)

##### transactionContext

[`TestingTransactionContext`](/api/testing/src/classes/testingtransactioncontext/)

##### baseUrl

`string`

##### lambdaHandler

[`LambdaHandler`](/api/preset-lambda/src/type-aliases/lambdahandler/) \| `undefined`

##### nodeHandler

[`NodeRequestHandler`](/api/transports-http/src/type-aliases/noderequesthandler/) \| `undefined`

##### cleanupOperations

readonly `TestKernelCleanupOperation`[]

##### resourceConnections

`ReadonlyMap`\<[`TestResource`](/api/testing/src/type-aliases/testresource/)\<`unknown`\>, `unknown`\>

##### resourceEvidenceBuffer

readonly [`TestKernelResourceEvidence`](/api/testing/src/type-aliases/testkernelresourceevidence/)[]

#### Returns

`TestKernel`

## Properties

### app

> `readonly` **app**: [`CrocoApp`](/api/transports-http/src/classes/crocoapp/)

***

### fidelity

> `readonly` **fidelity**: [`TestKernelFidelity`](/api/testing/src/type-aliases/testkernelfidelity/)

***

### http

> `readonly` **http**: [`TestKernelHttp`](/api/testing/src/classes/testkernelhttp/)

***

### transactionContext

> `readonly` **transactionContext**: [`TestingTransactionContext`](/api/testing/src/classes/testingtransactioncontext/)

## Accessors

### evidence

#### Get Signature

> **get** **evidence**(): readonly [`TestKernelEvidence`](/api/testing/src/type-aliases/testkernelevidence/)[]

##### Returns

readonly [`TestKernelEvidence`](/api/testing/src/type-aliases/testkernelevidence/)[]

***

### resourceEvidence

#### Get Signature

> **get** **resourceEvidence**(): readonly [`TestKernelResourceEvidence`](/api/testing/src/type-aliases/testkernelresourceevidence/)[]

##### Returns

readonly [`TestKernelResourceEvidence`](/api/testing/src/type-aliases/testkernelresourceevidence/)[]

## Methods

### \[asyncDispose\]()

> **\[asyncDispose\]**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

#### Implementation of

`AsyncDisposable.[asyncDispose]`

***

### dispose()

> **dispose**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

***

### get()

> **get**\<`T`\>(`token`): `T`

#### Type Parameters

##### T

`T`

#### Parameters

##### token

[`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<`T`\>

#### Returns

`T`

***

### request()

> **request**(`path`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### path

`string` \| `Request` \| `URL`

##### options?

[`TestingRequestOptions`](/api/testing/src/type-aliases/testingrequestoptions/) = `{}`

#### Returns

`Promise`\<`Response`\>

***

### resource()

> **resource**\<`TConnection`\>(`resource`): `TConnection`

#### Type Parameters

##### TConnection

`TConnection`

#### Parameters

##### resource

[`TestResource`](/api/testing/src/type-aliases/testresource/)\<`TConnection`\>

#### Returns

`TConnection`

***

### run()

#### Call Signature

> **run**\<`T`\>(`fn`): `Promise`\<`T`\>

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `Promise`\<`T`\>

##### Returns

`Promise`\<`T`\>

#### Call Signature

> **run**\<`T`\>(`fn`): `T`

##### Type Parameters

###### T

`T`

##### Parameters

###### fn

() => `T`

##### Returns

`T`
