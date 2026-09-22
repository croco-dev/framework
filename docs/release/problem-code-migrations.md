# Problem Code Migrations

## Desktop support removal

`desktop-codegen/invalid-contract-graph` and
`desktop-codegen/invalid-renderer-contract-graph` are deprecated without replacements because Croco
no longer ships desktop contracts, preload bridges, renderer clients, or their code-generation
commands. They remain in the Problem registry as historical diagnostic identities.

Applications that still depend on the unreleased desktop beta must pin the Croco repository to
`7dc3a10fb4bea30b667275e316b6e79971dde6c8` while migrating to another desktop stack. No published
npm version contains these desktop packages, and current Croco web REST, tRPC, GraphQL, SSR, and
server-action code generation do not replace or interpret desktop contracts.
