---
editUrl: false
next: false
prev: false
title: "BuildArtifact"
---

> **BuildArtifact** = `object`

Represents a single build output artifact

## Properties

### format

> `readonly` **format**: [`ArtifactFormat`](/api/presentation-preset/src/type-aliases/artifactformat/)

Format of this artifact

---

### path

> `readonly` **path**: `string`

Relative path from output directory (e.g. "index.js", "dist/worker.js")

---

### size?

> `readonly` `optional` **size?**: `number`

Optional file size in bytes (filled after build)

---

### type

> `readonly` **type**: [`ArtifactType`](/api/presentation-preset/src/type-aliases/artifacttype/)

Type of artifact
