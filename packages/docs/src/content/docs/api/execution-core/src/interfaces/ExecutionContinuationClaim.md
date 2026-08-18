---
editUrl: false
next: false
prev: false
title: "ExecutionContinuationClaim"
---

A lease held by one continuation worker.

The fencing token is required for every mutation made while the lease is held.
The processing token is stable for one logical checkpoint, including lease takeover.

## Properties

### attempt

> **attempt**: `number`

---

### expiresAt

> **expiresAt**: `Date`

---

### fencingToken

> **fencingToken**: `string`

---

### processingToken

> **processingToken**: `string`

---

### workerId

> **workerId**: `string`
