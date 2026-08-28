---
editUrl: false
next: false
prev: false
title: "fullRuntimeEnvPresets"
---

> `const` **fullRuntimeEnvPresets**: readonly \[\{ `client`: \{ \}; `server`: \{ `LOG_LEVEL`: `ZodDefault`\<`ZodEnum`\<\{ `debug`: `"debug"`; `error`: `"error"`; `info`: `"info"`; `warn`: `"warn"`; \}\>\>; `NODE_ENV`: `ZodDefault`\<`ZodEnum`\<\{ `development`: `"development"`; `production`: `"production"`; `test`: `"test"`; \}\>\>; `PORT`: `ZodDefault`\<`ZodCoercedNumber`\<`unknown`\>\>; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `DATABASE_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `REDIS_TOKEN`: `ZodOptional`\<`ZodString`\>; `REDIS_URL`: `ZodString`; \}; `shared`: \{ \}; \}, \{ `client`: \{ \}; `server`: \{ `R2_ACCESS_KEY_ID`: `ZodOptional`\<`ZodString`\>; `R2_ACCOUNT_ID`: `ZodOptional`\<`ZodString`\>; `R2_BUCKET`: `ZodOptional`\<`ZodString`\>; `R2_PUBLIC_URL_BASE`: `ZodOptional`\<`ZodString`\>; `R2_SECRET_ACCESS_KEY`: `ZodOptional`\<`ZodString`\>; \}; `shared`: \{ \}; \}\]
