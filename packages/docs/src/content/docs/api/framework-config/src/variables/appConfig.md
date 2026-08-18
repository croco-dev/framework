---
editUrl: false
next: false
prev: false
title: "appConfig"
---

> `const` **appConfig**: `object`

## Type Declaration

### client

> **client**: `object` = `{}`

### server

> **server**: `object`

#### server.LOG_LEVEL

> **LOG_LEVEL**: `ZodDefault`\<`ZodEnum`\<\{ `debug`: `"debug"`; `error`: `"error"`; `info`: `"info"`; `warn`: `"warn"`; \}\>\>

#### server.NODE_ENV

> **NODE_ENV**: `ZodDefault`\<`ZodEnum`\<\{ `development`: `"development"`; `production`: `"production"`; `test`: `"test"`; \}\>\>

#### server.PORT

> **PORT**: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>

### shared

> **shared**: `object` = `{}`
