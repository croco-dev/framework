---
editUrl: false
next: false
prev: false
title: "CrocoTestingApp"
---

## Constructors

### Constructor

> **new CrocoTestingApp**(`app`, `baseUrl?`): `CrocoTestingApp`

#### Parameters

##### app

[`CrocoApp`](/api/transports-http/src/classes/crocoapp/)

##### baseUrl?

`string` = `DEFAULT_BASE_URL`

#### Returns

`CrocoTestingApp`

## Properties

### app

> `readonly` **app**: [`CrocoApp`](/api/transports-http/src/classes/crocoapp/)

***

### baseUrl

> `readonly` **baseUrl**: `string` = `DEFAULT_BASE_URL`

## Methods

### assertProblem()

> **assertProblem**(`response`, `expected?`): `Promise`\<[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)\>

#### Parameters

##### response

`Response`

##### expected?

[`ProblemResponseExpectation`](/api/testing/src/type-aliases/problemresponseexpectation/) = `{}`

#### Returns

`Promise`\<[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)\>

***

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

### readJson()

> **readJson**\<`T`\>(`response`): `Promise`\<`T`\>

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### response

`Response`

#### Returns

`Promise`\<`T`\>

***

### readProblem()

> **readProblem**(`response`): `Promise`\<[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)\>

#### Parameters

##### response

`Response`

#### Returns

`Promise`\<[`ProblemDetails`](/api/problems-core/src/type-aliases/problemdetails/)\>

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

### rpcFetch()

> **rpcFetch**(): \{(`input`, `init?`): `Promise`\<`Response`\>; (`input`, `init?`): `Promise`\<`Response`\>; \}

#### Returns

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`RequestInfo` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>

> (`input`, `init?`): `Promise`\<`Response`\>

[MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch)

##### Parameters

###### input

`string` \| `Request` \| `URL`

###### init?

`RequestInit`

##### Returns

`Promise`\<`Response`\>
