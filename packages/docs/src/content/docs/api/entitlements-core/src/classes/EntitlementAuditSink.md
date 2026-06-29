---
editUrl: false
next: false
prev: false
title: "EntitlementAuditSink"
---

## Constructors

### Constructor

> **new EntitlementAuditSink**(): `EntitlementAuditSink`

#### Returns

`EntitlementAuditSink`

## Properties

### token

> `readonly` `static` **token**: [`Token`](/api/framework-context/src/classes/token/)\<`EntitlementAuditSink`\>

## Methods

### recordEntitlementGuard()

> `abstract` **recordEntitlementGuard**(`event`): `void` \| `Promise`\<`void`\>

#### Parameters

##### event

[`EntitlementGuardAuditEvent`](/api/entitlements-core/src/type-aliases/entitlementguardauditevent/)

#### Returns

`void` \| `Promise`\<`void`\>
