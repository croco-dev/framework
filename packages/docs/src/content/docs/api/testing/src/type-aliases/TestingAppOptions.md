---
editUrl: false
next: false
prev: false
title: "TestingAppOptions"
---

> **TestingAppOptions** = `Omit`\<[`AppConfig`](/api/transports-http/src/interfaces/appconfig/), `"controllers"`\> & [`TestingHarnessOptions`](/api/testing/src/type-aliases/testingharnessoptions/) & `object`

## Type Declaration

### autoRegisterControllers?

> `readonly` `optional` **autoRegisterControllers?**: `boolean`

### controllers

> `readonly` **controllers**: readonly `TestingConstructor`[]

### logger?

> `readonly` `optional` **logger?**: [`TestLogger`](/api/testing/src/type-aliases/testlogger/)

### providers?

> `readonly` `optional` **providers?**: readonly [`TestingProvider`](/api/testing/src/type-aliases/testingprovider/)[]

### resetContainer?

> `readonly` `optional` **resetContainer?**: `boolean`

### transactionContext?

> `readonly` `optional` **transactionContext?**: [`TestingTransactionContext`](/api/testing/src/classes/testingtransactioncontext/) \| [`TestingTransactionContextOptions`](/api/testing/src/type-aliases/testingtransactioncontextoptions/) \| `false`
