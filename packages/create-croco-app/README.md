# create-croco-app

Project scaffolding CLI for Croco applications.

`create-croco-app` generates starter applications from Croco templates, validates
interactive and noninteractive options, reports Problem-backed CLI failures, and
provides generated-app smoke coverage for the supported presets.

## Public API

- `create-croco-app` binary - interactive and scripted project generation.
- `--json` output - machine-readable result and diagnostic contract for automation.
- `create-croco-app/dist/verification.js` - programmatic parsing, runtime validation, generation,
  and separate raw, normalized, and resolved option types.

## Usage

```bash
npx create-croco-app@latest my-saas-api --goal saas-api --scope @myorg --no-install --no-git
cd my-saas-api && pnpm install && pnpm demo:smoke
```

The `saas-api` goal generates the REST SaaS workspace, provider and tenant manifests,
and the zero-credential `demo:smoke` success path. Generated projects are pnpm
workspaces; `--no-install --no-git` keeps the documented setup deterministic before
the explicit install and smoke commands.

### Astryx Vite UI profile

Astryx is available as an opt-in beta UI profile for the Vite SPA frontend runtime:

```bash
npx create-croco-app@latest my-app \
  --preset ddd-fullstack \
  --scope @myorg \
  --api graphql \
  --api-hosting standalone \
  --web-apps web \
  --frontend-deploy vite-spa \
  --ui astryx \
  --no-install \
  --no-git
```

The generated app imports Astryx's prebuilt CSS, so it does not add a StyleX compiler plugin.
Use `--ui none` for an explicit provider-neutral Vite starter. Omitting `--ui` preserves the
generator's existing output for compatibility. Astryx does not change `@croco/frontend-react` or
apply to meta-vite profiles in this release.

Generated projects include the package manager command and next-step instructions in
the CLI result.

## Verification

```bash
pnpm --filter create-croco-app test
pnpm --filter create-croco-app typecheck
pnpm create-croco-app:smoke
```
