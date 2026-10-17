# @croco/features-drizzle

## 0.1.0

### Minor Changes

- 7665cbd: Registered policies can be edited, reviewed, scheduled, published, and resolved by scoped revision, with PostgreSQL persistence and an admin console using the same release contract.
- 80d86ff: Run experiments with stable revision-scoped assignments, explicit evaluation failures,
  separate delivery exposures and authorized start, pause, stop and configuration commands.
  Persist concurrent worker decisions in PostgreSQL and operate registered experiments
  through the console while preserving the existing feature flag API.

### Patch Changes

- 17c8730: Resolve ESM and CommonJS consumers to declaration files matching each published implementation format.
- Updated dependencies [7665cbd]
- Updated dependencies [914f195]
- Updated dependencies [b278729]
- Updated dependencies [269d9df]
- Updated dependencies [7cdfcae]
- Updated dependencies [1084825]
- Updated dependencies [f8c52e7]
- Updated dependencies [82a10b8]
- Updated dependencies [6fa6843]
- Updated dependencies [17c8730]
- Updated dependencies [67e0cbe]
- Updated dependencies [157089a]
- Updated dependencies [5d54fb4]
- Updated dependencies [5e886a9]
- Updated dependencies [918a960]
- Updated dependencies [25bfb06]
- Updated dependencies [80d86ff]
- Updated dependencies [406964c]
- Updated dependencies [ed75f31]
  - @croco/features-core@0.1.0
  - @croco/execution-core@0.1.0

## 0.0.1

- Add PostgreSQL policy revision, review, activation, receipt, decision, and schedule persistence.
- Add the verified-delivery scheduling bridge and restart recovery entrypoint.
