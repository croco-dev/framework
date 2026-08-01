---
editUrl: false
next: false
prev: false
title: "getContractProviderMappingDriftInput"
---

> **getContractProviderMappingDriftInput**(`graph`, `providerName`): readonly [`ContractProviderMappingDriftInput`](/api/protocols-core/src/type-aliases/contractprovidermappingdriftinput/)[]

Produces credential-free mapping input that an opt-in provider preflight can compare remotely.
Calling this function never performs network I/O or claims that provider state was inspected.

## Parameters

### graph

[`ContractMonetizationGraph`](/api/protocols-core/src/type-aliases/contractmonetizationgraph/)

### providerName

`string`

## Returns

readonly [`ContractProviderMappingDriftInput`](/api/protocols-core/src/type-aliases/contractprovidermappingdriftinput/)[]
