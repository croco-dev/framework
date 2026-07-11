# create-croco-app

Project scaffolding CLI for Croco applications.

`create-croco-app` generates starter applications from Croco templates, validates
interactive and noninteractive options, reports Problem-backed CLI failures, and
provides generated-app smoke coverage for the supported presets.

## Public API

- `create-croco-app` binary - interactive and scripted project generation.
- `--json` output - machine-readable result and diagnostic contract for automation.

## Usage

```bash
npx create-croco-app@latest my-saas-api --goal saas-api --scope @myorg --no-install --no-git
cd my-saas-api && pnpm install && pnpm demo:smoke
```

The `saas-api` goal generates the REST SaaS workspace, provider and tenant manifests,
and the zero-credential `demo:smoke` success path. Generated projects are pnpm
workspaces; `--no-install --no-git` keeps the documented setup deterministic before
the explicit install and smoke commands.

## Verification

```bash
pnpm --filter create-croco-app test
pnpm --filter create-croco-app typecheck
pnpm create-croco-app:smoke
```
