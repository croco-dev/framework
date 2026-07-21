---
"create-croco-app": minor
"@croco/openapi-spec": patch
"@croco/rpc-codegen": patch
"@croco/ui-astryx": patch
---

- fix: generate projects whose validation path runs without a POSIX compatibility shell
- fix: load controller contract graphs from Windows drive paths without collapsing the TypeScript rootDir
- fix: load OpenAPI contract sources from Windows drive paths without collapsing the TypeScript rootDir
- fix: render Astryx generated-app smoke fixtures from the published CommonJS adapter without relying on an ambient React binding
- change: expose machine-readable next steps as structured command, argument, and working-directory data
