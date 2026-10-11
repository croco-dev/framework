---
editUrl: false
next: false
prev: false
title: "JourneyDryRunResult"
---

> **JourneyDryRunResult** = `object`

## Properties

### checks

> **checks**: `Omit`\<[`JourneyFacts`](/api/lifecycle-core/src/type-aliases/journeyfacts/), `"goal"`\>

---

### episode

> **episode**: [`JourneyEpisode`](/api/lifecycle-core/src/type-aliases/journeyepisode/)

---

### goal

> **goal**: `boolean` \| `"unknown"`

---

### nodes

> **nodes**: readonly [`JourneyNode`](/api/lifecycle-core/src/type-aliases/journeynode/)[]

---

### steps

> **steps**: [`JourneyDryRunStep`](/api/lifecycle-core/src/type-aliases/journeydryrunstep/)[]
