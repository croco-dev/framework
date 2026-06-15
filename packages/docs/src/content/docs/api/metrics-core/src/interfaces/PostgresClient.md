---
editUrl: false
next: false
prev: false
title: "PostgresClient"
---

PostgreSQL 클라이언트 인터페이스 (pg 또는 호환 라이브러리)

## Description

pg.Pool, pg.Client, 또는 Prisma Client 등과 호환되는 최소 인터페이스

## Methods

### query()

> **query**\<`T`\>(`sql`, `params?`): `Promise`\<\{ `rows`: `T`[]; \}\>

쿼리 실행

#### Type Parameters

##### T

`T` = `unknown`

#### Parameters

##### sql

`string`

SQL 쿼리 문자열 (parameterized query: $1, $2, ...)

##### params?

`unknown`[]

쿼리 파라미터

#### Returns

`Promise`\<\{ `rows`: `T`[]; \}\>

쿼리 결과 rows
