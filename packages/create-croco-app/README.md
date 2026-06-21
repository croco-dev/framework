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
pnpm create croco-app my-service
pnpm create croco-app my-service --preset saas-api --package-manager pnpm --json
```

Generated projects include the package manager command and next-step instructions in
the CLI result.

## Verification

```bash
pnpm --filter create-croco-app test
pnpm --filter create-croco-app typecheck
pnpm create-croco-app:smoke
```
