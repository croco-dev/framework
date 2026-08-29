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

---

### isProduction

#### Get Signature

> **get** **isProduction**(): `boolean`

##### Returns

`boolean`

---

### isTest

#### Get Signature

> **get** **isTest**(): `boolean`

##### Returns

`boolean`

## Methods

### get()

> **get**\<`K`\>(`key`): `Readonly`\<`UndefinedOptional`\<`Simplify`\<`InferOutput`\<`RuntimeEnvSchema`\<readonly \[\{ `client`: \{ \}; `server`: \{ `LOG_LEVEL`: `ZodDefault`\<`ZodEnum`\<...\>\>; `NODE_ENV`: `ZodDefault`\<`ZodEnum`\<...\>\>; `PORT`: `ZodDefault`\<`ZodCoercedNumber`\<...\>\>; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `DATABASE_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `REDIS_TOKEN`: `ZodOptional`\<`ZodString`\>; `REDIS_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `R2_ACCESS_KEY_ID`: `ZodOptional`\<`ZodString`\>; `R2_ACCOUNT_ID`: `ZodOptional`\<`ZodString`\>; `R2_BUCKET`: `ZodOptional`\<`ZodString`\>; `R2_PUBLIC_URL_BASE`: `ZodOptional`\<`ZodString`\>; `R2_SECRET_ACCESS_KEY`: `ZodOptional`\<`ZodString`\>; \}; `shared`: \{ \}; \}\]\>\>\>\>\>\[`K`\]

Type-safe environment variable getter

#### Type Parameters

##### K

`K` _extends_ `"NODE_ENV"` \| `"PORT"` \| `"LOG_LEVEL"` \| `"DATABASE_URL"` \| `"REDIS_URL"` \| `PossiblyUndefinedKeys`\<`Simplify`\<`InferOutput`\<`RuntimeEnvSchema`\<readonly \[\{ `client`: \{ \}; `server`: \{ `LOG_LEVEL`: `ZodDefault`\<`ZodEnum`\<\{ `debug`: ...; `error`: ...; `info`: ...; `warn`: ...; \}\>\>; `NODE_ENV`: `ZodDefault`\<`ZodEnum`\<\{ `development`: ...; `production`: ...; `test`: ...; \}\>\>; `PORT`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `DATABASE_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `REDIS_TOKEN`: `ZodOptional`\<`ZodString`\>; `REDIS_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `R2_ACCESS_KEY_ID`: `ZodOptional`\<`ZodString`\>; `R2_ACCOUNT_ID`: `ZodOptional`\<`ZodString`\>; `R2_BUCKET`: `ZodOptional`\<`ZodString`\>; `R2_PUBLIC_URL_BASE`: `ZodOptional`\<`ZodString`\>; `R2_SECRET_ACCESS_KEY`: `ZodOptional`\<`ZodString`\>; \}; `shared`: \{ \}; \}\]\>\>\>\>

#### Parameters

##### key

`K`

#### Returns

`Readonly`\<`UndefinedOptional`\<`Simplify`\<`InferOutput`\<`RuntimeEnvSchema`\<readonly \[\{ `client`: \{ \}; `server`: \{ `LOG_LEVEL`: `ZodDefault`\<`ZodEnum`\<...\>\>; `NODE_ENV`: `ZodDefault`\<`ZodEnum`\<...\>\>; `PORT`: `ZodDefault`\<`ZodCoercedNumber`\<...\>\>; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `DATABASE_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `REDIS_TOKEN`: `ZodOptional`\<`ZodString`\>; `REDIS_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `R2_ACCESS_KEY_ID`: `ZodOptional`\<`ZodString`\>; `R2_ACCOUNT_ID`: `ZodOptional`\<`ZodString`\>; `R2_BUCKET`: `ZodOptional`\<`ZodString`\>; `R2_PUBLIC_URL_BASE`: `ZodOptional`\<`ZodString`\>; `R2_SECRET_ACCESS_KEY`: `ZodOptional`\<`ZodString`\>; \}; `shared`: \{ \}; \}\]\>\>\>\>\>\[`K`\]
