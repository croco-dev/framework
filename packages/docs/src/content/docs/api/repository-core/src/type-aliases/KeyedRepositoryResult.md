---
editUrl: false
next: false
prev: false
title: "KeyedRepositoryResult"
---

> **KeyedRepositoryResult**\<`ID`, `T`\> = `object`

A repository result explicitly associated with the requested ID that produced it.

## Type Parameters

### ID

`ID`

### T

`T`

## Properties

### key

> `readonly` **key**: `ID`

The requested ID that produced this result.

---

### value

> `readonly` **value**: `T`

The entity resolved for the key.
