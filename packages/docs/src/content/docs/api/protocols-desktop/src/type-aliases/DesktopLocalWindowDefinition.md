---
editUrl: false
next: false
prev: false
title: "DesktopLocalWindowDefinition"
---

> **DesktopLocalWindowDefinition**\<`TExpose`, `TReceive`\> = `object`

## Type Parameters

### TExpose

`TExpose` *extends* readonly [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)[] = readonly [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)[]

### TReceive

`TReceive` *extends* readonly [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/)[] = readonly [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/)[]

## Properties

### definitionType

> `readonly` **definitionType**: `"window"`

***

### expose

> `readonly` **expose**: `TExpose`

***

### receive

> `readonly` **receive**: `TReceive`

***

### trust

> `readonly` **trust**: `"local"`
