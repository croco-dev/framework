# Cloudflare Worker build

Run these commands from this web app directory after installing the workspace dependencies:

- `pnpm build` runs the existing Next.js build, including any GraphQL contract check or DI generation.
- `pnpm build:worker` runs OpenNext, which calls `build` first and then creates `.open-next/worker.js`
  and `.open-next/assets`, matching `wrangler.toml`. This command builds locally without deploying
  or requiring Cloudflare credentials.
- `pnpm preview` builds the Worker and starts a local Wrangler preview.
- `pnpm deploy` builds the Worker and deploys it to Cloudflare; this command requires your Cloudflare
  account and deployment permissions.

Keep `build` as the Next.js build: calling OpenNext from it would recursively invoke itself.
The builder is pinned to a release compatible with the generated Next.js 15.5 app. Upgrade the
builder and its Next.js/Wrangler peer dependencies together.

The Node.js toolchain used to build the app does not change the deployment runtime. The result runs
in Cloudflare Workers with `nodejs_compat`. A successful local build does not certify your database,
other providers, or remote deployment for Workers. Configure and verify those separately.

See the [OpenNext setup guide](https://opennext.js.org/cloudflare/get-started) for bindings and caching.
