---
editUrl: false
next: false
prev: false
title: "createRlsTxAdapter"
---

> **createRlsTxAdapter**\<`TDb`\>(`db`, `tenantProvider`, `options?`): [`TxAdapter`](/api/tx-core/src/interfaces/txadapter/)\<[`InferTxClient`](/api/tx-drizzle/src/type-aliases/infertxclient/)\<`TDb`\>, [`InferTxOptions`](/api/tx-drizzle/src/type-aliases/infertxoptions/)\<`TDb`\>\>

## Type Parameters

### TDb

`TDb` _extends_ [`DrizzleDb`](/api/tx-drizzle/src/interfaces/drizzledb/)\<`unknown`, `never`\>

## Parameters

### db

`TDb`

### tenantProvider

[`RlsTenantProvider`](/api/tx-drizzle/src/interfaces/rlstenantprovider/)

### options?

[`RlsOptions`](/api/tx-drizzle/src/interfaces/rlsoptions/) = `{}`

## Returns

[`TxAdapter`](/api/tx-core/src/interfaces/txadapter/)\<[`InferTxClient`](/api/tx-drizzle/src/type-aliases/infertxclient/)\<`TDb`\>, [`InferTxOptions`](/api/tx-drizzle/src/type-aliases/infertxoptions/)\<`TDb`\>\>
