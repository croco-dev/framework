---
editUrl: false
next: false
prev: false
title: "ConfigService"
---

## Constructors

### Constructor

> **new ConfigService**(): `ConfigService`

#### Returns

`ConfigService`

## Accessors

### isDevelopment

#### Get Signature

> **get** **isDevelopment**(): `boolean`

##### Returns

`boolean`

***

### isProduction

#### Get Signature

> **get** **isProduction**(): `boolean`

##### Returns

`boolean`

***

### isTest

#### Get Signature

> **get** **isTest**(): `boolean`

##### Returns

`boolean`

## Methods

### get()

> **get**\<`K`\>(`key`): `Readonly`\<\{ `DATABASE_URL`: `string`; `LOG_LEVEL`: `"error"` \| `"debug"` \| `"info"` \| `"warn"`; `NODE_ENV`: `"development"` \| `"test"` \| `"production"`; `PORT`: `number`; `R2_ACCESS_KEY_ID?`: `string`; `R2_ACCOUNT_ID?`: `string`; `R2_BUCKET?`: `string`; `R2_PUBLIC_URL_BASE?`: `string`; `R2_SECRET_ACCESS_KEY?`: `string`; `REDIS_TOKEN?`: `string`; `REDIS_URL`: `string`; \}\>\[`K`\]

Type-safe environment variable getter

#### Type Parameters

##### K

`K` *extends* `"R2_ACCOUNT_ID"` \| `"R2_ACCESS_KEY_ID"` \| `"R2_SECRET_ACCESS_KEY"` \| `"R2_BUCKET"` \| `"R2_PUBLIC_URL_BASE"` \| `"REDIS_URL"` \| `"REDIS_TOKEN"` \| `"DATABASE_URL"` \| `"NODE_ENV"` \| `"PORT"` \| `"LOG_LEVEL"`

#### Parameters

##### key

`K`

#### Returns

`Readonly`\<\{ `DATABASE_URL`: `string`; `LOG_LEVEL`: `"error"` \| `"debug"` \| `"info"` \| `"warn"`; `NODE_ENV`: `"development"` \| `"test"` \| `"production"`; `PORT`: `number`; `R2_ACCESS_KEY_ID?`: `string`; `R2_ACCOUNT_ID?`: `string`; `R2_BUCKET?`: `string`; `R2_PUBLIC_URL_BASE?`: `string`; `R2_SECRET_ACCESS_KEY?`: `string`; `REDIS_TOKEN?`: `string`; `REDIS_URL`: `string`; \}\>\[`K`\]
