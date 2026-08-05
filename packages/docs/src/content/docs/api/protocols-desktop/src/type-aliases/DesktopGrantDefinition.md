---
editUrl: false
next: false
prev: false
title: "DesktopGrantDefinition"
---

> **DesktopGrantDefinition**\<`TResource`, `TAccess`, `TScope`, `TLifetime`\> = `object`

## Type Parameters

### TResource

`TResource` _extends_ [`DesktopGrantResourceKind`](/api/protocols-desktop/src/type-aliases/desktopgrantresourcekind/) = [`DesktopGrantResourceKind`](/api/protocols-desktop/src/type-aliases/desktopgrantresourcekind/)

### TAccess

`TAccess` _extends_ [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/) = [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

### TScope

`TScope` _extends_ `DesktopGrantScopeFor`\<`TResource`\> = `DesktopGrantScopeFor`\<`TResource`\>

### TLifetime

`TLifetime` _extends_ [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/) = [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/)

## Properties

### ~standard

> `readonly` **~standard**: `object`

#### types?

> `readonly` `optional` **types?**: `object`

##### types.input

> `readonly` **input**: [`DesktopGrantReference`](/api/protocols-desktop/src/type-aliases/desktopgrantreference/)\<`TResource`, `TAccess`, `TScope`, `TLifetime`\>

##### types.output

> `readonly` **output**: [`DesktopGrantReference`](/api/protocols-desktop/src/type-aliases/desktopgrantreference/)\<`TResource`, `TAccess`, `TScope`, `TLifetime`\>

#### validate

> `readonly` **validate**: (`value`) => \{ `value`: [`DesktopGrantReference`](/api/protocols-desktop/src/type-aliases/desktopgrantreference/)\<`TResource`, `TAccess`, `TScope`, `TLifetime`\>; \} \| \{ `issues`: readonly `object`[]; \}

##### Parameters

###### value

`unknown`

##### Returns

\{ `value`: [`DesktopGrantReference`](/api/protocols-desktop/src/type-aliases/desktopgrantreference/)\<`TResource`, `TAccess`, `TScope`, `TLifetime`\>; \} \| \{ `issues`: readonly `object`[]; \}

#### vendor

> `readonly` **vendor**: `"@croco/protocols-desktop"`

#### version

> `readonly` **version**: `1`

---

### access

> `readonly` **access**: `TAccess`

---

### definitionType

> `readonly` **definitionType**: `"grant"`

---

### lifetime

> `readonly` **lifetime**: `TLifetime`

---

### resource

> `readonly` **resource**: `TResource`

---

### scope

> `readonly` **scope**: `TScope`
