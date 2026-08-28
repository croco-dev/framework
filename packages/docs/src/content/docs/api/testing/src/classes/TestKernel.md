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

> **new TestKernel**(`app`, `fidelity`, `controls`, `scope`, `transactionContext`, `baseUrl`, `lambdaHandler`, `nodeHandler`, `cleanupOperations`, `resourceConnections`, `resourceEvidenceBuffer`): `TestKernel`

#### Parameters

##### app

[`CrocoApp`](/api/transports-http/src/classes/crocoapp/)

##### fidelity

[`TestKernelFidelity`](/api/testing/src/type-aliases/testkernelfidelity/)

##### controls

[`TestRuntime`](/api/testing/src/classes/testruntime/)

##### scope

[`TestKernelApplicationRuntime`](/api/testing/src/interfaces/testkernelapplicationruntime/)

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

---

### clock

> `readonly` **clock**: [`TestClock`](/api/testing/src/classes/testclock/)

---

### environment

> `readonly` **environment**: [`TestEnvironment`](/api/testing/src/classes/testenvironment/)

---

### fidelity

> `readonly` **fidelity**: [`TestKernelFidelity`](/api/testing/src/type-aliases/testkernelfidelity/)

---

### http

> `readonly` **http**: [`TestKernelHttp`](/api/testing/src/classes/testkernelhttp/)

---

### ids

> `readonly` **ids**: [`TestIdSource`](/api/testing/src/classes/testidsource/)

---

### network

> `readonly` **network**: [`TestNetwork`](/api/testing/src/classes/testnetwork/)

---

### random

> `readonly` **random**: [`TestRandomSource`](/api/testing/src/classes/testrandomsource/)

---

### retry

> `readonly` **retry**: [`TestRetryDependencies`](/api/testing/src/type-aliases/testretrydependencies/)

---

### transactionContext

> `readonly` **transactionContext**: [`TestingTransactionContext`](/api/testing/src/classes/testingtransactioncontext/)

## Accessors

### evidence

#### Get Signature

> **get** **evidence**(): readonly [`TestKernelEvidence`](/api/testing/src/type-aliases/testkernelevidence/)[]

##### Returns

readonly [`TestKernelEvidence`](/api/testing/src/type-aliases/testkernelevidence/)[]

---

### replay

#### Get Signature

> **get** **replay**(): [`TestReplayMetadata`](/api/testing/src/type-aliases/testreplaymetadata/)

##### Returns

[`TestReplayMetadata`](/api/testing/src/type-aliases/testreplaymetadata/)

---

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

---

### dispose()

> **dispose**(): `Promise`\<`void`\>

#### Returns

`Promise`\<`void`\>

---

### expectClean()

> **expectClean**(): `void`

#### Returns

`void`

---

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

---

### request()

> **request**(`path`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### path

`string` \| `Request` \| `URL`

##### options?

[`TestingRequestOptions`](/api/testing/src/type-aliases/testingrequestoptions/) = `{}`

#### Returns

`Promise`\<`Response`\>

---

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

---

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

---

### track()

> **track**\<`T`\>(`operation`, `work`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

`Promise`\<`T`\>

##### work

[`TestKernelTrackedWork`](/api/testing/src/type-aliases/testkerneltrackedwork/)

#### Returns

`Promise`\<`T`\>

---

### trackEventHandler()

> **trackEventHandler**\<`T`\>(`operation`, `source`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

`Promise`\<`T`\>

##### source

`string`

#### Returns

`Promise`\<`T`\>

---

### trackResource()

> **trackResource**\<`T`\>(`operation`, `source`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

`Promise`\<`T`\>

##### source

`string`

#### Returns

`Promise`\<`T`\>

---

### trackSpan()

> **trackSpan**\<`T`\>(`operation`, `source`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

`Promise`\<`T`\>

##### source

`string`

#### Returns

`Promise`\<`T`\>

---

### waitUntil()

> **waitUntil**\<`T`\>(`operation`, `source?`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T`

#### Parameters

##### operation

`Promise`\<`T`\>

##### source?

`string` = `"wait-until"`

#### Returns

`Promise`\<`T`\>
