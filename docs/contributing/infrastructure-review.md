# Infrastructure review contract

New public capabilities, Providers, Hosts, deployment Profiles and support-changing fixes must evaluate
Kubernetes, AWS Lambda and Cloudflare before implementation. This policy requires decisions, not three
implementations. Runtime claims remain in `docs/package-catalog.json`, `RuntimeCapabilityManifest` and
Profile metadata; the generated extension matrix remains the compatibility table. Reviews do not certify providers.

## Scope and conservative selection

`pnpm infrastructure-review:check -- --base <base-sha> [--head <head-sha>]` compares the immutable head against its merge-base with the requested base. Base-only changes on a diverged branch are excluded.
`pnpm check` also runs it; local default base is `origin/trunk`, CI supplies its immutable verification base.
The PR companion runs the same gate and includes decisions, constraints, reusable providers and diagnostics
in its JSON and Markdown reports. The gate never rewrites files.

The gate selects changed production sources in public `packages/*/src`, runtime/infrastructure manifests, `presentation-preset/runtime-profiles.json`, runtime-affecting
package manifest fields (including `type`, `browser`, `imports`, `bin` and `os`/`cpu`/`libc` deployment constraints), and changed catalog role/runtime metadata. Source deletions count. Private packages,
tests/fixtures, documentation and release-only version bumps are excluded. Unchanged historical packages
need no record. Workspace and effective published runtime fields are both checked, including
`bundledDependencies`/`bundleDependencies` and runtime overrides in `publishConfig`. Published version or tag
changes alone remain excluded. Formatting/comment-only edits are excluded using parsed TypeScript output (literal content is preserved).
An internal pure refactor cannot be inferred safely from a diff:
record `internal-pure-refactor` with reasoned `not-applicable` decisions to exempt it without smoke tests.
A reviewer must check semantic scope: the gate cannot prove that an exemption is truthful or that a test actually
exercises the declared host. New public behavior in code outside these package surfaces still follows the checklist.

## Change evidence format

Add one JSON document under `docs/infrastructure-reviews/` per coherent change (a descriptive name or issue ID).
Use `schemaVersion: 1` and a non-empty `changes` array. Each changed public package has exactly one record
in the review documents changed by this PR. Existing records cannot substitute for a new decision.

Each change has:

| Field             | Meaning                                                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `package`         | Package directory slug, e.g. `storage-node`; not an npm specifier                                                            |
| `classification`  | `pure-contract`, `protocol-render`, `runtime-adapter`, `durable-provider`, `deployment-profile`, or `internal-pure-refactor` |
| `reason`          | What changed and why its infrastructure decision applies                                                                     |
| `files`           | Object mapping every selected changed file to its exact content SHA-256, or `deleted`                                        |
| `catalogRuntimes` | Exact ordered `packageRoles[package].runtimes` snapshot; empty means unclaimed, not universal support                        |
| `profiles`        | Decisions for `kubernetes`, `aws-lambda`, and `cloudflare`                                                                   |

A decision has `result`, `reason`, `providers` (existing adapter/contract identifiers; empty when irrelevant),
`constraints` (capability, storage and lifecycle restrictions), and non-empty `references` (tracked repository
file paths). Results are `supported`, `conditional`, `unsupported`, `unverified`, or `not-applicable`.
`conditional` needs an explicit constraint. Supported/conditional claims must exist in the catalog's runtime
list: Kubernetes → `node`; Lambda → `lambda`; Cloudflare → `cloudflare-workers`, or `node` when
`host: "node-container"`. Cloudflare support decisions require `host: "workers"` or `host: "node-container"`.
Kubernetes is not a new runtime enum; a Cloudflare Container never means Worker isolate support.

For example, a Node-only Provider can record:

```json
{
  "result": "conditional",
  "reason": "Reuse the Node adapter only with bounded per-invocation connections.",
  "providers": ["@croco/example-node"],
  "constraints": ["Flush and close before the Lambda invocation returns."],
  "references": ["packages/example-node/src/index.ts"]
}
```

This fragment illustrates a Lambda decision; it is not a complete review or a claim about an existing package.
Use `unsupported` with a reason for missing Workers support. Pure domain logic can use `not-applicable`
for all three: explain why it has no host capabilities, storage or lifecycle requirements. No smoke is needed.

## Execution evidence and limits

A `supported` decision additionally needs `evidence` with `kind: "host-runtime"` or `"live-infrastructure"`,
`runtime`, tracked test `path`, exact Vitest `testName` (the complete suite plus test name), and test content
`sha256`. Compute hashes from the final committed bytes, for example with `shasum -a 256 <file>`.
A successful receipt must name the pinned file as well as the exact test title. The checker executes that exact named test with the repository's pinned Vitest, in its package/example directory
or at the root for script tests. Zero matches, skipped-only execution, test failures, stale test hashes and `mock`
evidence fail. Execution requires a clean checkout at the reviewed head, preventing receipts for another tree.
Verification/companion report directories are ignored generated outputs, so the CI reporting runner can retain
its checkpoints while tracked source mutations still fail. Tests can use the existing no-credential runtime harness; they must exercise the claimed host path.
Each execution is bounded to two minutes. Longer live checks should remain separately recorded as unverified
here until an appropriate bounded conformance test exists; do not weaken timeouts to obtain support.

`host-runtime` means that the selected code path executed, not that a real Kubernetes cluster, AWS account or
Cloudflare deployment was certified. State missing live infrastructure checks in `constraints`, even after a
successful local Node/Workers harness test. `conditional` records limitations without claiming execution;
`unverified` explicitly marks missing proof. A reviewer verifies that test inputs, harness and assertions support
the claimed host. Certification and npm release remain separate existing gates.

## Failure and recovery

| Stable diagnostic                                | Recovery                                                                                                               |
| ------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `INFRA_REVIEW_MISSING`                           | Add exactly one changed review for the package; do not backfill untouched packages                                     |
| `INFRA_REVIEW_REMOVED`                           | Preserve review history; supersede the decision explicitly                                                             |
| `INFRA_REVIEW_INVALID`, `INFRA_DECISION_INVALID` | Correct version, classification, required profile fields or tracked references                                         |
| `INFRA_SCOPE_DRIFT`                              | Review the changed implementation and refresh final content hashes, including catalog changes                          |
| `INFRA_RUNTIME_DRIFT`                            | Reconcile the reviewed runtime snapshot/decision with the catalog and runtime manifests; run `pnpm docs:catalog:check` |
| `INFRA_EXECUTION_REQUIRED`                       | Supply a pinned named host test or use unverified/unsupported rather than unsupported evidence                         |
| `INFRA_EXECUTION_FAILED`                         | Fix the failing/missing/skipped test; keep the execution claim unverified until it passes                              |
| `INFRA_EVIDENCE_CHECKOUT`                        | Commit the reviewed tree and run the gate at that clean head                                                           |
| `INFRA_SKILL_DRIFT`                              | Edit canonical `.agents/skills/croco`, then run `pnpm skill:write && pnpm skill:check`                                 |

Generated documentation/catalog drift is still enforced by `pnpm docs:catalog:check`. Generated Skill drift
is also checked in this gate, including documentation-only PRs. Never edit generated compatibility tables or
Skill copies by hand. Diagnostic fixture tests cover supported Node/conditional Lambda/unsupported Workers,
pure domain exemptions, missing/false/stale execution claims, source/runtime drift, deleted records and exclusions.
