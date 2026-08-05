---
editUrl: false
next: false
prev: false
title: "DesktopGrantReference"
---

> **DesktopGrantReference**\<`TResource`, `TAccess`, `TScope`, `TLifetime`\> = `string` & `object`

A renderer-visible reference to a resource authorized by the desktop runtime.

This intentionally brands a token rather than a filesystem path. Token issuance,
redemption, and path validation belong to the desktop runtime.

## Type Declaration

### \[DESKTOP\_GRANT\_REFERENCE\]

> `readonly` **\[DESKTOP\_GRANT\_REFERENCE\]**: `object`

#### \[DESKTOP\_GRANT\_REFERENCE\].access

> `readonly` **access**: `TAccess`

#### \[DESKTOP\_GRANT\_REFERENCE\].lifetime

> `readonly` **lifetime**: `TLifetime`

#### \[DESKTOP\_GRANT\_REFERENCE\].resource

> `readonly` **resource**: `TResource`

#### \[DESKTOP\_GRANT\_REFERENCE\].scope

> `readonly` **scope**: `TScope`

## Type Parameters

### TResource

`TResource` *extends* [`DesktopGrantResourceKind`](/api/protocols-desktop/src/type-aliases/desktopgrantresourcekind/) = [`DesktopGrantResourceKind`](/api/protocols-desktop/src/type-aliases/desktopgrantresourcekind/)

### TAccess

`TAccess` *extends* [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/) = [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

### TScope

`TScope` *extends* `DesktopGrantScopeFor`\<`TResource`\> = `DesktopGrantScopeFor`\<`TResource`\>

### TLifetime

`TLifetime` *extends* [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/) = [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/)
