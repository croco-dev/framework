# @croco/ratelimit-upstash

## 0.0.4

### Patch Changes

- d707a0c: Published package manifests now declare the Croco framework GitHub repository metadata required for npm provenance verification.
- 58b689a: HTTP rate-limit outcome skip flags now refund successful limiter checks so skipped success or failure responses do not consume quota, with core and Upstash stores exposing the matching refund contract.
- 817218a: All Upstash Redis and QStash adapters now run reusable conformance coverage with redacted provider Problems and no-credential default test paths.
- Updated dependencies [1dc1607]
- Updated dependencies [8c5b00c]
- Updated dependencies [48ce207]
- Updated dependencies [6c26eb4]
- Updated dependencies [f8842d3]
- Updated dependencies [d707a0c]
- Updated dependencies [58b689a]
- Updated dependencies [cac7e99]
- Updated dependencies [aacdad6]
  - @croco/problems-core@0.0.4
  - @croco/ratelimit-core@0.0.4

## 0.0.3

### Patch Changes

- 99f2a6b: fix: align CommonJS package export maps with emitted dist files
- Updated dependencies [99f2a6b]
  - @croco/problems-core@0.0.3
  - @croco/ratelimit-core@0.0.3
