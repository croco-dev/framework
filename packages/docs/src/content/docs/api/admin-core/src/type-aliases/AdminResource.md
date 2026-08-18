---
editUrl: false
next: false
prev: false
title: "AdminResource"
---

> **AdminResource** = `object`

## Properties

### actions

> `readonly` **actions**: readonly [`AdminAction`](/api/admin-core/src/type-aliases/adminaction/)[]

***

### description?

> `readonly` `optional` **description?**: `string`

***

### detail

> `readonly` **detail**: [`AdminResourceDetailDescriptor`](/api/admin-core/src/type-aliases/adminresourcedetaildescriptor/)

***

### fields

> `readonly` **fields**: [`NonEmptyArray`](/api/admin-core/src/type-aliases/nonemptyarray/)\<[`AdminResourceField`](/api/admin-core/src/type-aliases/adminresourcefield/)\>

***

### identity

> `readonly` **identity**: [`AdminResourceIdentity`](/api/admin-core/src/type-aliases/adminresourceidentity/)

***

### kind

> `readonly` **kind**: `string`

***

### label

> `readonly` **label**: `string`

***

### list

> `readonly` **list**: [`AdminResourceListDescriptor`](/api/admin-core/src/type-aliases/adminresourcelistdescriptor/)

***

### metadata?

> `readonly` `optional` **metadata?**: `Readonly`\<`Record`\<`string`, `unknown`\>\>

***

### problems?

> `readonly` `optional` **problems?**: readonly [`AdminProblemContract`](/api/admin-core/src/type-aliases/adminproblemcontract/)[]

***

### scope

> `readonly` **scope**: [`AdminResourceScope`](/api/admin-core/src/type-aliases/adminresourcescope/)

***

### source

> `readonly` **source**: [`AdminResourceSource`](/api/admin-core/src/type-aliases/adminresourcesource/)
