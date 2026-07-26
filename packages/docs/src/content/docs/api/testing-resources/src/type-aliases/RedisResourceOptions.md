---
editUrl: false
next: false
prev: false
title: "RedisResourceOptions"
---

> **RedisResourceOptions** = [`ResourceImageOptions`](/api/testing-resources/src/type-aliases/resourceimageoptions/) & `object`

## Type Declaration

### id?

> `readonly` `optional` **id?**: `string`

### providers?

> `readonly` `optional` **providers?**: readonly [`TestResourceProvider`](/api/testing-resources/src/type-aliases/testresourceprovider/)\<[`RedisTestConnection`](/api/testing-resources/src/type-aliases/redistestconnection/)\>[]

### provides?

> `readonly` `optional` **provides?**: [`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<[`RedisTestConnection`](/api/testing-resources/src/type-aliases/redistestconnection/)\>

### startupTimeoutMs?

> `readonly` `optional` **startupTimeoutMs?**: `number`
