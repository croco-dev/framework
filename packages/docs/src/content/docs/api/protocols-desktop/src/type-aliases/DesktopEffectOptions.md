---
editUrl: false
next: false
prev: false
title: "DesktopEffectOptions"
---

> **DesktopEffectOptions**\<`TNamespace`, `TMethods`, `TAccess`, `TGrants`\> = `object`

## Type Parameters

### TNamespace

`TNamespace` _extends_ `string`

### TMethods

`TMethods` _extends_ `Readonly`\<`Record`\<`string`, [`DesktopEffectMethodDefinition`](/api/protocols-desktop/src/type-aliases/desktopeffectmethoddefinition/)\>\>

### TAccess

`TAccess` _extends_ [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

### TGrants

`TGrants` _extends_ readonly [`AnyDesktopGrant`](/api/protocols-desktop/src/type-aliases/anydesktopgrant/)[]

## Properties

### access

> `readonly` **access**: `TAccess`

---

### grants?

> `readonly` `optional` **grants?**: `TGrants`

---

### methods

> `readonly` **methods**: `TMethods`

---

### namespace

> `readonly` **namespace**: `TNamespace`
