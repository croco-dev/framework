---
editUrl: false
next: false
prev: false
title: "parseContractGraphSnapshot"
---

> **parseContractGraphSnapshot**(`value`): [`ContractGraphSnapshot`](/api/protocols-core/src/type-aliases/contractgraphsnapshot/) \| `null`

Validates and normalizes persisted ContractGraph snapshot v1 artifacts.

Historical v1 snapshots predate consumer coverage, route contracts, entitlements, and schema
JSON-safety metadata. The initial epoch also predates Problem responses. Those coherent
artifact-wide shapes are normalized only after every persisted member has been validated.

## Parameters

### value

`unknown`

## Returns

[`ContractGraphSnapshot`](/api/protocols-core/src/type-aliases/contractgraphsnapshot/) \| `null`
