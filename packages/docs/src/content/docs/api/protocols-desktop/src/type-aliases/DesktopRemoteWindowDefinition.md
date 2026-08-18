---
editUrl: false
next: false
prev: false
title: "DesktopRemoteWindowDefinition"
---

> **DesktopRemoteWindowDefinition**\<`TInitialUrl`, `TAllowedOrigins`\> = `object`

## Type Parameters

### TInitialUrl

`TInitialUrl` *extends* `string` = `string`

### TAllowedOrigins

`TAllowedOrigins` *extends* readonly `string`[] = readonly `string`[]

## Properties

### allowedOrigins

> `readonly` **allowedOrigins**: `TAllowedOrigins`

***

### definitionType

> `readonly` **definitionType**: `"window"`

***

### expose?

> `readonly` `optional` **expose?**: `never`

***

### initialUrl

> `readonly` **initialUrl**: `TInitialUrl`

***

### receive?

> `readonly` `optional` **receive?**: `never`

***

### trust

> `readonly` **trust**: `"remote"`
