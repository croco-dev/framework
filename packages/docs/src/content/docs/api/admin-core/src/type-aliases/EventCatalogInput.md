---
editUrl: false
next: false
prev: false
title: "EventCatalogInput"
---

> **EventCatalogInput** = [`EventCatalogScope`](/api/admin-core/src/type-aliases/eventcatalogscope/) & `object`

## Type Declaration

### grantedPermissions

> `readonly` **grantedPermissions**: readonly `string`[]

### principalId

> `readonly` **principalId**: `string`

Permissions must be resolved and validated by the server for this principal and scope.

### signal?

> `readonly` `optional` **signal?**: `AbortSignal`

### source

> `readonly` **source**: [`EventCatalogSource`](/api/admin-core/src/type-aliases/eventcatalogsource/)
