---
"create-croco-app": patch
---

Generated GraphQL Lambda API scaffolds now declare the Apollo Lambda integration dependency required by the Lambda handler, keep that Lambda-only package out of non-Lambda GraphQL apps, and include scoped shared-package TypeScript configs for clean generated-project typechecks.
