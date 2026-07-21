---
"create-croco-app": patch
"@croco/ui-astryx": patch
---

Generated applications now declare the supported Node.js train, include an `.nvmrc`, document recovery for unsupported versions, reject generation before writing files when the active Node.js version is too old, and keep Astryx server-rendering smoke checks runnable on that train.
