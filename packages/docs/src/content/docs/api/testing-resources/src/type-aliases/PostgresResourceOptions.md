---
editUrl: false
next: false
prev: false
title: "PostgresResourceOptions"
---

> **PostgresResourceOptions** = [`ResourceImageOptions`](/api/testing-resources/src/type-aliases/resourceimageoptions/) & `object`

## Type Declaration

### id?

> `readonly` `optional` **id?**: `string`

### migrations?

> `readonly` `optional` **migrations?**: `string`

### mode

> `readonly` **mode**: [`TestResourceMode`](/api/testing/src/type-aliases/testresourcemode/)

### password?

> `readonly` `optional` **password?**: `string`

### providers?

> `readonly` `optional` **providers?**: readonly [`TestResourceProvider`](/api/testing-resources/src/type-aliases/testresourceprovider/)\<[`PostgresTestConnection`](/api/testing-resources/src/type-aliases/postgrestestconnection/)\>[]

### provides?

> `readonly` `optional` **provides?**: [`TokenIdentifier`](/api/framework-context/src/type-aliases/tokenidentifier/)\<[`PostgresTestConnection`](/api/testing-resources/src/type-aliases/postgrestestconnection/)\>

### startupTimeoutMs?

> `readonly` `optional` **startupTimeoutMs?**: `number`

### username?

> `readonly` `optional` **username?**: `string`
