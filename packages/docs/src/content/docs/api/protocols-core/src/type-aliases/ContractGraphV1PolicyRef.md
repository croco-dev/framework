---
editUrl: false
next: false
prev: false
title: "ContractGraphV1PolicyRef"
---

> **ContractGraphV1PolicyRef** = \{ `id`: `string`; `owner`: [`ContractMetadataOwner`](/api/protocols-core/src/type-aliases/contractmetadataowner/); `role`: `string`; `type`: `"rest.role"`; \} \| \{ `entitlement`: [`ContractGraphSnapshotEntitlementRequirement`](/api/protocols-core/src/type-aliases/contractgraphsnapshotentitlementrequirement/); `id`: `string`; `owner`: [`ContractMetadataOwner`](/api/protocols-core/src/type-aliases/contractmetadataowner/); `type`: `"entitlement"`; \}

Policy requirement attached to a ContractGraph v1 route.
