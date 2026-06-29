---
editUrl: false
next: false
prev: false
title: "OutputContract"
---

> **OutputContract** = `object`

Core output contract that ALL presets must conform to.
Describes the complete build output of a preset.

## Properties

### artifacts

> `readonly` **artifacts**: readonly [`BuildArtifact`](/api/presentation-preset/src/type-aliases/buildartifact/)[]

List of all build artifacts

***

### buildTime

> `readonly` **buildTime**: `string`

When the build was performed (ISO 8601)

***

### checksum?

> `readonly` `optional` **checksum?**: `string`

Optional checksum for integrity verification

***

### entries

> `readonly` **entries**: readonly [`EntryDescriptor`](/api/presentation-preset/src/type-aliases/entrydescriptor/)[]

Entry point descriptors

***

### format

> `readonly` **format**: [`ArtifactFormat`](/api/presentation-preset/src/type-aliases/artifactformat/)

Output format of the build

***

### presetName

> `readonly` **presetName**: `string`

Preset name (e.g. "node", "lambda", "cloudflare")
