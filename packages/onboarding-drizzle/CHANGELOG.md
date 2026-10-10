# @croco/onboarding-drizzle

## 0.1.0

### Minor Changes

- 1380ce5: Preserve concurrent onboarding step completions and emit the overall completion transition once.
- 6a60235: Applications can publish versioned onboarding goals, count confirmed domain actions in durable episodes, and show progress and next actions in the admin and user interfaces. Existing checklist completion remains available.
- b37b8d5: Persist every public onboarding lifecycle field through Drizzle create, update, and read operations, with a shared store conformance suite and nullable compatibility migration for existing rows.

### Patch Changes

- b278729: - fix: block critical test tooling advisories
- 7cdfcae: Declare audited package side effects so bundlers remove pure imports while preserving required initialization and CSS.
- 6a8f097: Return JSONB-backed onboarding step completion timestamps as `Date` instances from state reads and atomic step completion results.
- 17c8730: Resolve ESM and CommonJS consumers to declaration files matching each published implementation format.
- 67e0cbe: fix: resolve published package types before runtime conditions
- 82299ba: Preserve the input completion timestamp when an existing onboarding reaches completion in a non-UTC process time zone.
- 0ae97d0: Clear the previous completion step identity when saving incomplete onboarding state so reset progress only reports a new completion after all required steps finish.
- 1c843a5: Preserve runtime class-decorator metadata in published ESM and CJS bundles so Croco can resolve concrete constructor dependencies from installed packages.
- d6276dd: Preserve the recorded completion step when saving subsequent onboarding state updates.
- 5d54fb4: declare Apache-2.0 license across all publishable package manifests and ship LICENSE in published packages
- Updated dependencies [029130d]
- Updated dependencies [f74f7d9]
- Updated dependencies [2ac9119]
- Updated dependencies [4ca14ab]
- Updated dependencies [38cba9c]
- Updated dependencies [b278729]
- Updated dependencies [7008727]
- Updated dependencies [868ea09]
- Updated dependencies [1380ce5]
- Updated dependencies [b5b2da5]
- Updated dependencies [7cdfcae]
- Updated dependencies [9404839]
- Updated dependencies [08cfa9b]
- Updated dependencies [26f4b9e]
- Updated dependencies [88c6ce1]
- Updated dependencies [280215e]
- Updated dependencies [f438532]
- Updated dependencies [51df5f6]
- Updated dependencies [2cc5438]
- Updated dependencies [d1a03e6]
- Updated dependencies [3342494]
- Updated dependencies [34114fd]
- Updated dependencies [7df16bb]
- Updated dependencies [0fa2546]
- Updated dependencies [008f3f0]
- Updated dependencies [0584573]
- Updated dependencies [500c048]
- Updated dependencies [543eda3]
- Updated dependencies [6489abb]
- Updated dependencies [6aeb0b0]
- Updated dependencies [5535392]
- Updated dependencies [2973efe]
- Updated dependencies [a8d6717]
- Updated dependencies [1b39af2]
- Updated dependencies [dda0a50]
- Updated dependencies [7d248c5]
- Updated dependencies [9b379dd]
- Updated dependencies [a72e2f2]
- Updated dependencies [be7408f]
- Updated dependencies [16cc286]
- Updated dependencies [734c41b]
- Updated dependencies [eed5e70]
- Updated dependencies [90b3517]
- Updated dependencies [d20f4eb]
- Updated dependencies [1f3aeb7]
- Updated dependencies [26bcc38]
- Updated dependencies [cfdc20a]
- Updated dependencies [0b5e89b]
- Updated dependencies [17c8730]
- Updated dependencies [0d662c6]
- Updated dependencies [67e0cbe]
- Updated dependencies [163b65c]
- Updated dependencies [e3bb85e]
- Updated dependencies [6a60235]
- Updated dependencies [4a15ff9]
- Updated dependencies [58ed44f]
- Updated dependencies [9784c13]
- Updated dependencies [852de2d]
- Updated dependencies [b37b8d5]
- Updated dependencies [1c843a5]
- Updated dependencies [88d8bcc]
- Updated dependencies [45882f1]
- Updated dependencies [f0c328e]
- Updated dependencies [6bac6de]
- Updated dependencies [f38d9fa]
- Updated dependencies [efb33f9]
- Updated dependencies [157089a]
- Updated dependencies [5d54fb4]
- Updated dependencies [b68b670]
- Updated dependencies [3f99747]
- Updated dependencies [51cf890]
- Updated dependencies [0530556]
- Updated dependencies [92f606b]
- Updated dependencies [e4bfcb2]
- Updated dependencies [cc8106d]
- Updated dependencies [094e57b]
- Updated dependencies [10fc7b4]
- Updated dependencies [8dc091a]
- Updated dependencies [8aa72a1]
- Updated dependencies [286a5ad]
- Updated dependencies [3240609]
- Updated dependencies [f141c18]
- Updated dependencies [a56992a]
- Updated dependencies [555d5fe]
- Updated dependencies [e506f59]
- Updated dependencies [0b73dd1]
- Updated dependencies [fccf65b]
- Updated dependencies [f9193be]
- Updated dependencies [8191e27]
- Updated dependencies [8c1acbd]
- Updated dependencies [99da854]
- Updated dependencies [67cf48e]
- Updated dependencies [e493f8b]
- Updated dependencies [d2539a0]
- Updated dependencies [57b786f]
- Updated dependencies [3f61772]
- Updated dependencies [fdb2c90]
- Updated dependencies [76e734f]
- Updated dependencies [903466a]
  - @croco/tx-core@0.1.0
  - @croco/events-core@0.1.0
  - @croco/framework-context@0.1.0
  - @croco/events-tx@0.2.0
  - @croco/tx-drizzle@0.1.0
  - @croco/onboarding-core@1.0.0

## 0.0.4

### Patch Changes

- 513188f: Drizzle-backed SaaS adapters now publish shared conformance evidence and redacted readiness diagnostics before beta maturity.
- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- Updated dependencies [ee924c0]
- Updated dependencies [5403360]
- Updated dependencies [e12e825]
- Updated dependencies [6831875]
- Updated dependencies [513188f]
- Updated dependencies [a61dcd4]
- Updated dependencies [4e329aa]
- Updated dependencies [4c7fcd9]
- Updated dependencies [1dc1607]
- Updated dependencies [d707a0c]
- Updated dependencies [9c2ac20]
- Updated dependencies [de7610e]
- Updated dependencies [14bd9f8]
- Updated dependencies [0618b12]
- Updated dependencies [41ee87a]
- Updated dependencies [c54e7b5]
- Updated dependencies [d1552a5]
- Updated dependencies [844234f]
  - @croco/framework-context@0.0.4
  - @croco/tx-drizzle@0.0.4
  - @croco/onboarding-core@0.0.4
  - @croco/tx-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
- Updated dependencies [99f2a6b]
  - @croco/framework-context@0.0.3
  - @croco/onboarding-core@0.0.3
  - @croco/tx-core@0.0.3
  - @croco/tx-drizzle@0.0.3
