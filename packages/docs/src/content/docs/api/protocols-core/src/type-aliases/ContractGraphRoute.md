---
editUrl: false
next: false
prev: false
title: "ContractGraphRoute"
---

> **ContractGraphRoute** = [`RouteIR`](/api/protocols-core/src/interfaces/routeir/) & `object`

## Type Declaration

### access

> `readonly` **access**: [`ContractAccessMetadata`](/api/protocols-core/src/type-aliases/contractaccessmetadata/)

### controllerPath

> `readonly` **controllerPath**: `string`

### entitlements

> `readonly` **entitlements**: readonly [`ContractEntitlementRequirement`](/api/protocols-core/src/type-aliases/contractentitlementrequirement/)[]

### meter?

> `readonly` `optional` **meter?**: `object`

#### meter.descriptor?

> `readonly` `optional` **descriptor?**: `ContractMeteredMetadata`\[`"meter"`\]

#### meter.key

> `readonly` **key**: `string`

### operationId

> `readonly` **operationId**: `string`

### routeId

> `readonly` **routeId**: `string`
