---
"@croco/esbuild-plugin": patch
---

Generate NodeNext DI graph imports with their emitted JavaScript extensions while retaining extensionless TypeScript source imports for existing bundlers. Validate the graph using the consumer's module settings so NodeNext ESM applications can include generated graphs in normal project typechecks without breaking source bundler builds.
