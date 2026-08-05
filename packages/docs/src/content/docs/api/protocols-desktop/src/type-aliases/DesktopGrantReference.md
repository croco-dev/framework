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

### \[DESKTOP_GRANT_REFERENCE\]

> `readonly` **\[DESKTOP_GRANT_REFERENCE\]**: `object`

#### \[DESKTOP_GRANT_REFERENCE\].access

> `readonly` **access**: `TAccess`

#### \[DESKTOP_GRANT_REFERENCE\].lifetime

> `readonly` **lifetime**: `TLifetime`

#### \[DESKTOP_GRANT_REFERENCE\].resource

> `readonly` **resource**: `TResource`

#### \[DESKTOP_GRANT_REFERENCE\].scope

> `readonly` **scope**: `TScope`

## Type Parameters

### TResource

`TResource` _extends_ [`DesktopGrantResourceKind`](/api/protocols-desktop/src/type-aliases/desktopgrantresourcekind/) = [`DesktopGrantResourceKind`](/api/protocols-desktop/src/type-aliases/desktopgrantresourcekind/)

### TAccess

`TAccess` _extends_ [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/) = [`DesktopGrantAccess`](/api/protocols-desktop/src/type-aliases/desktopgrantaccess/)

### TScope

`TScope` _extends_ `DesktopGrantScopeFor`\<`TResource`\> = `DesktopGrantScopeFor`\<`TResource`\>

### TLifetime

`TLifetime` _extends_ [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/) = [`DesktopGrantLifetime`](/api/protocols-desktop/src/type-aliases/desktopgrantlifetime/)
