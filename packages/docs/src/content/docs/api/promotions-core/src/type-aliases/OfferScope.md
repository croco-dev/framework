---
editUrl: false
next: false
prev: false
title: "OfferScope"
---

> **OfferScope** = `object`

Offer scope shared by subjects, policies, quotes, and claims.

A complete scope is required everywhere: omitting the tenant never grants a
global permission. The server validates the full scope on every transition.

## Properties

### appId

> `readonly` **appId**: `string`

---

### environment

> `readonly` **environment**: `string`

---

### tenantId

> `readonly` **tenantId**: `string`
