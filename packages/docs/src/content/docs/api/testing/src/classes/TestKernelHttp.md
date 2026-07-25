---
editUrl: false
next: false
prev: false
title: "TestKernelHttp"
---

## Constructors

### Constructor

> **new TestKernelHttp**(`kernel`): `TestKernelHttp`

#### Parameters

##### kernel

[`TestKernel`](/api/testing/src/classes/testkernel/)

#### Returns

`TestKernelHttp`

## Methods

### delete()

> **delete**(`path`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### path

`string` \| `URL`

##### options?

`Omit`\<[`TestingRequestOptions`](/api/testing/src/type-aliases/testingrequestoptions/), `"method"`\> = `{}`

#### Returns

`Promise`\<`Response`\>

***

### get()

> **get**(`path`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### path

`string` \| `URL`

##### options?

`Omit`\<[`TestingRequestOptions`](/api/testing/src/type-aliases/testingrequestoptions/), `"method"`\> = `{}`

#### Returns

`Promise`\<`Response`\>

***

### patch()

> **patch**(`path`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### path

`string` \| `URL`

##### options?

`Omit`\<[`TestingRequestOptions`](/api/testing/src/type-aliases/testingrequestoptions/), `"method"`\> = `{}`

#### Returns

`Promise`\<`Response`\>

***

### post()

> **post**(`path`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### path

`string` \| `URL`

##### options?

`Omit`\<[`TestingRequestOptions`](/api/testing/src/type-aliases/testingrequestoptions/), `"method"`\> = `{}`

#### Returns

`Promise`\<`Response`\>

***

### put()

> **put**(`path`, `options?`): `Promise`\<`Response`\>

#### Parameters

##### path

`string` \| `URL`

##### options?

`Omit`\<[`TestingRequestOptions`](/api/testing/src/type-aliases/testingrequestoptions/), `"method"`\> = `{}`

#### Returns

`Promise`\<`Response`\>

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
