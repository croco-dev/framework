---
"create-croco-app": minor
"@croco/problems-core": patch
---

Generated applications now require Node.js 24. Generated manifests declare `engines.node: ">=24"`, the generated
`.nvmrc` pins `24`, workspaces pin `pnpm@12.6.0`, Docker templates build on `node:24-slim`, bundles target `node24`,
and templates depend on `@types/node` `^24`. SaaS presets no longer carry a separate Node.js 22.5 floor.
`create-croco-app` rejects Node.js 22 and 23 with `create-croco-app/unsupported-node-version` before writing files,
and the Problem registry recovery guidance now names Node.js 24. Cloudflare meta-vite fullstack workspaces now include
`libs/**/*`, so the generated shared libraries install their own dependencies instead of relying on binaries that pnpm
11 exposed from sibling workspace packages.
