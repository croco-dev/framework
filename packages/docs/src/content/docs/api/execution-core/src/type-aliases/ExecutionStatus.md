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
- running → completed | failed | timed_out | cancelled
- failed → retrying → running
- retrying → failed (when max retries exhausted)
- timed_out → retrying

Terminal states (no outgoing transitions):

- completed, cancelled, failed (when max retries exhausted)
