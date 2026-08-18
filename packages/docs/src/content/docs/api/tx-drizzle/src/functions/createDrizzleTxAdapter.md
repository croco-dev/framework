---
editUrl: false
next: false
prev: false
title: "createDrizzleTxAdapter"
---

> **createDrizzleTxAdapter**\<`TDb`\>(`db`): [`TxAdapter`](/api/tx-core/src/interfaces/txadapter/)\<[`InferTxClient`](/api/tx-drizzle/src/type-aliases/infertxclient/)\<`TDb`\>, [`InferTxOptions`](/api/tx-drizzle/src/type-aliases/infertxoptions/)\<`TDb`\>\>

## Type Parameters

### TDb

`TDb` _extends_ [`DrizzleDb`](/api/tx-drizzle/src/interfaces/drizzledb/)\<`unknown`, `unknown`\>

## Parameters

### db

`TDb`

Drizzle DB 인스턴스 (PostgreSQL, MySQL, SQLite 지원)

## Returns

[`TxAdapter`](/api/tx-core/src/interfaces/txadapter/)\<[`InferTxClient`](/api/tx-drizzle/src/type-aliases/infertxclient/)\<`TDb`\>, [`InferTxOptions`](/api/tx-drizzle/src/type-aliases/infertxoptions/)\<`TDb`\>\>

TxAdapter 인스턴스
