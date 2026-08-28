---
editUrl: false
next: false
prev: false
title: "DesktopEffectDefinition"
---

> **DesktopEffectDefinition**\<`TNamespace`, `TMethods`, `TAccess`, `TGrants`\> = `object`

## Type Parameters

### TNamespace

`TNamespace` _extends_ `string` = `string`

### TMethods

`TMethods` _extends_ `Readonly`\<`Record`\<`string`, [`DesktopEffectMethodDefinition`](/api/protocols-desktop/src/type-aliases/desktopeffectmethoddefinition/)\>\> = `Readonly`\<`Record`\<`string`, [`DesktopEffectMethodDefinition`](/api/protocols-desktop/src/type-aliases/desktopeffectmethoddefinition/)\>\>

### TAccess

`TAccess` _extends_ [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/) = [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

### TGrants

`TGrants` _extends_ readonly [`AnyDesktopGrant`](/api/protocols-desktop/src/type-aliases/anydesktopgrant/)[] = readonly [`AnyDesktopGrant`](/api/protocols-desktop/src/type-aliases/anydesktopgrant/)[]

## Properties

### access

> `readonly` **access**: `TAccess`

---

### definitionType

> `readonly` **definitionType**: `"effect"`

---

### grants

> `readonly` **grants**: `TGrants`

---

### methods

> `readonly` **methods**: `TMethods`

---

### namespace

> `readonly` **namespace**: `TNamespace`
