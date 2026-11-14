# @croco/cohort-drizzle

## 0.2.0

### Minor Changes

- 3aec14e: Registered attribute and event conditions can be previewed and published as versioned cohort audiences for campaigns.

### Patch Changes

- 17c8730: Resolve ESM and CommonJS consumers to declaration files matching each published implementation format.
- ba0a622: Reject cohort rollback when its source publication is withdrawn before the new publication transaction, and serialize withdrawal with publication across PostgreSQL isolation levels.
- Updated dependencies [17c8730]
- Updated dependencies [3aec14e]
  - @croco/cohort-core@0.2.0
