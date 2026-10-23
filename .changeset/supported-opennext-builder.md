---
"create-croco-app": patch
---

Generated OpenNext frontends use the adapter release with Next.js 16.4 support while keeping the supported-version guard enabled.

OpenNext build output stays outside the pnpm workspace graph so subsequent commands continue to use the generated application's lockfile.
