---
"@croco/transports-graphql": patch
"create-croco-app": patch
---

Use the GraphQL Yoga executor compatible with patched GraphQL Tools utilities and pin patched utilities in generated application workspaces.

Independent consumers of `@croco/transports-graphql` need an application-root override for `@graphql-tools/utils@<=12.0.0` to `12.0.3`; repository overrides are not inherited by installed packages. Generated workspaces include this override.
