# @croco/admin-postgres

## 0.2.0

### Minor Changes

- 9ed442c: Explore fixed customer samples through scoped, paginated timelines and audited fact or hypothesis notes, with PostgreSQL persistence in the dedicated `@croco/admin-postgres` provider package and a standalone React workspace.
- 98f7987: Preserve scoped learning records with separate facts, hypotheses, evidence, decisions and next actions. Learning mutations, revision history, audit and retry receipts commit atomically in PostgreSQL. The learning workspace uses the same authorized APIs and retains local drafts on revision conflicts.

  The learning-registry/input and learning-registry/transition Problems use validation status 422; learning-registry/denied uses 403; learning-registry/not-found uses 404; learning-registry/revision-conflict and learning-registry/idempotency-conflict use 409; learning-registry/storage-failed uses 500. Their generated registry categories and recovery metadata match the runtime contracts.

### Patch Changes

- 17c8730: Resolve ESM and CommonJS consumers to declaration files matching each published implementation format.
- Updated dependencies [0df6df9]
- Updated dependencies [7665cbd]
- Updated dependencies [7d6ec6b]
- Updated dependencies [e30b3e8]
- Updated dependencies [f305867]
- Updated dependencies [eb80ac6]
- Updated dependencies [9684c00]
- Updated dependencies [b278729]
- Updated dependencies [7390b1b]
- Updated dependencies [84a05bd]
- Updated dependencies [64af41f]
- Updated dependencies [7cdfcae]
- Updated dependencies [3b99ee8]
- Updated dependencies [5fc43c0]
- Updated dependencies [014e7dd]
- Updated dependencies [9ed442c]
- Updated dependencies [5d620c2]
- Updated dependencies [7aabe26]
- Updated dependencies [bef753f]
- Updated dependencies [da23725]
- Updated dependencies [98f7987]
- Updated dependencies [17c8730]
- Updated dependencies [67e0cbe]
- Updated dependencies [6a60235]
- Updated dependencies [bdf13e1]
- Updated dependencies [c8e39b5]
- Updated dependencies [5d54fb4]
- Updated dependencies [4c2a077]
- Updated dependencies [63ee9fc]
- Updated dependencies [f766166]
- Updated dependencies [3f08459]
- Updated dependencies [f17460a]
- Updated dependencies [918a960]
- Updated dependencies [a34879e]
- Updated dependencies [d1198c2]
- Updated dependencies [80d86ff]
- Updated dependencies [c5fb714]
- Updated dependencies [f0e9c0d]
- Updated dependencies [95be142]
- Updated dependencies [3aec14e]
- Updated dependencies [b242060]
- Updated dependencies [913c441]
  - @croco/admin-core@0.1.0
