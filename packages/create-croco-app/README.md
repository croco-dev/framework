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
- `create-croco-app/programmatic` - side-effect-free generation and option resolution.
- `create-croco-app/generator` - programmatic generation with a structured success result.

Importing either `create-croco-app` or `create-croco-app/programmatic` does not parse arguments,
write files, print output, or terminate the process. Programmatic consumers can resolve the same
noninteractive options as the CLI and then call the generator directly:

```ts
import { generate, normalizeNonInteractiveOptions } from "create-croco-app/programmatic";

const options = normalizeNonInteractiveOptions({
  projectName: "my-app",
  scope: "@myorg",
  preset: "blank",
  installDeps: false,
  initGit: false,
});

const result = await generate("./my-app", options, { outputMode: "human" });
console.log(result.targetDir, result.nextSteps);
```

Programmatic callers receive the canonical target directory, effective configuration,
generated contract artifacts, completed post-actions, and structured next commands:

```ts
import { generate, type GeneratorOptions, type GenerationResult } from "create-croco-app/generator";

const options: GeneratorOptions = {
  projectName: "my-app",
  scope: "@myorg",
  preset: "blank",
  webApps: [],
  apiHosting: "standalone",
  db: [],
  agentRules: true,
  installDeps: false,
  initGit: false,
};

const result: GenerationResult = await generate("./my-app", options);
console.log(result.targetDir, result.nextSteps);
```

Generation failures still reject with the existing Problem contract; a partial scaffold is
never returned as a successful `GenerationResult`.

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

Every scaffold also includes a commented `.env.example` limited to the capabilities selected at
generation time. Copy it to `.env` only when you are ready to configure local values, and extend it
from the documentation for each integration you add. The generator never creates `.env` or writes
provider credentials.

Generated Drizzle dependencies use the exact semver range from the repository's
`pnpm-workspace.yaml` catalog. Package-manifest normalization copies that range into
the published generator metadata, so catalog upgrades require no template or provider-profile edit.

## Verification

```bash
pnpm --filter create-croco-app test
pnpm --filter create-croco-app typecheck
pnpm create-croco-app:smoke
```
