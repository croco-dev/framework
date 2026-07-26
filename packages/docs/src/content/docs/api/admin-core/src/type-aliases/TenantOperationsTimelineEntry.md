---
editUrl: false
next: false
prev: false
title: "TenantOperationsTimelineEntry"
---

> **TenantOperationsTimelineEntry** = `object`

Structural subset of `@croco/admin-ops` OperationsTimelineEvent. Keeping the
contract structural lets admin-core remain independent from an operations adapter.

## Properties

### correlationId?

> `readonly` `optional` **correlationId?**: `string`

***

### id

> `readonly` **id**: `string`

***

### problem?

> `readonly` `optional` **problem?**: `object`

#### code?

> `readonly` `optional` **code?**: `string`

#### message?

> `readonly` `optional` **message?**: `string`

#### retryable?

> `readonly` `optional` **retryable?**: `boolean`

***

### recoveryAction?

> `readonly` `optional` **recoveryAction?**: `string`

***

### severity

> `readonly` **severity**: `"debug"` \| `"info"` \| `"warning"` \| `"error"` \| `"critical"`

***

### source

> `readonly` **source**: `string`

***

### summary?

> `readonly` `optional` **summary?**: `string`

***

### tenantId?

> `readonly` `optional` **tenantId?**: `string`

***

### timestamp

> `readonly` **timestamp**: `Date`

***

### title

> `readonly` **title**: `string`
