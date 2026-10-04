---
editUrl: false
next: false
prev: false
title: "ExecutionStatus"
---

> **ExecutionStatus** = `"pending"` \| `"running"` \| `"completed"` \| `"failed"` \| `"cancelled"` \| `"retrying"` \| `"timed_out"`

Execution status represents the current state of an execution.

State transitions (allowed only):

- pending → running | cancelled
- running → completed | failed | timed_out | cancelled | retrying
- failed → retrying → running
- retrying → failed (when max retries exhausted)
- timed_out → retrying

A running execution enters retrying when fail() receives a retryable error and attempts remain.

Terminal states (no outgoing transitions):

- completed, cancelled, failed (when max retries exhausted)
