---
editUrl: false
next: false
prev: false
title: "DesktopLocalWindowDefinition"
---

> **DesktopLocalWindowDefinition**\<`TExpose`, `TReceive`\> = `object`

## Type Parameters

### TExpose

`TExpose` _extends_ readonly [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)[] = readonly [`KeyedDesktopCommand`](/api/protocols-desktop/src/type-aliases/keyeddesktopcommand/)[]

### TReceive

`TReceive` _extends_ readonly [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/)[] = readonly [`KeyedDesktopEvent`](/api/protocols-desktop/src/type-aliases/keyeddesktopevent/)[]

## Properties

### definitionType

> `readonly` **definitionType**: `"window"`

---

### expose

> `readonly` **expose**: `TExpose`

---

### receive

> `readonly` **receive**: `TReceive`

---

### trust

> `readonly` **trust**: `"local"`
