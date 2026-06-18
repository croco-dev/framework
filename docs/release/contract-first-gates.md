# Contract-first gates

Croco REST controllers can be validated before generating OpenAPI documents or RPC clients. Use the
contract graph commands as the release gate for generated artifacts.

## Recommended flow

For an intentional contract change, refresh the committed baseline:

```bash
pnpm contract:check
pnpm contract:snapshot
```

`contract:check` validates controller metadata and fails on contract graph errors such as missing
path params, duplicate operation ids, or multiple request bodies.

`contract:snapshot` writes a deterministic `contract-graph.snapshot.json` file. Commit this file
when a contract change is intentional.

For CI and release verification, do not run `contract:snapshot` before the drift check:

```bash
pnpm contract:verify
```

Generated `create-croco-app` REST templates expose `contract:verify` and `ci:contracts` scripts.
They compare the committed snapshot against current controllers first, then regenerate OpenAPI and
RPC client artifacts from the accepted contract.

`contract:diff` compares the committed snapshot with current controllers and fails on current graph
errors or breaking contract drift. Removed controllers, removed routes, HTTP method/path changes,
removed operation ids, required request-field additions, incompatible request schema changes, and
incompatible response schema changes are breaking. Additive routes and optional request fields are
reported as non-breaking.

`contract:openapi` and `contract:client` should run after the check and diff gates so generated
artifacts are produced only from an accepted contract graph.

The committed baseline is `contract-graph.snapshot.json`. `openapi.json` and generated RPC client
files may be committed when consumers need checked-in artifacts, but CI should regenerate them from
the server controllers rather than treating hand-edited generated output as authoritative.

## Direct CLI usage

```bash
croco contracts check --controllers 'apps/api-server/src/controllers/**/*.ts'
croco contracts check --controllers 'apps/api-server/src/controllers/**/*.ts' --json --out contract-graph.snapshot.json
croco contracts diff --baseline contract-graph.snapshot.json --controllers 'apps/api-server/src/controllers/**/*.ts'
```

`croco contracts check --json` prints the same stable JSON snapshot to stdout when `--out` is not
provided. `croco contracts diff --json` prints a machine-readable diff report and exits non-zero
when breaking changes exist.
