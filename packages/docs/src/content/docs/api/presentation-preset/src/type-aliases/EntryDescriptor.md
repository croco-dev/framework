---
editUrl: false
next: false
prev: false
title: "EntryDescriptor"
---

> **EntryDescriptor** = `object`

Entry point descriptor — maps export subpath to the entry file
Maps CrocoPresetConfig.output entries to actual file paths

## Properties

### cjs?

> `readonly` `optional` **cjs?**: `string`

The CJS entry file path (only for dual format)

---

### exportName

> `readonly` **exportName**: `string`

Export subpath (e.g. ".", "./entry", "./handler", "./fetch")

---

### main

> `readonly` **main**: `string`

The main entry file path

---

### types

> `readonly` **types**: `string`

The type declaration file path
