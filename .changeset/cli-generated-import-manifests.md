---
"@croco/cli": patch
"create-croco-app": patch
---

CLI generators now validate generated imports against target app manifests before writing files, and API-server scaffolds declare the common generator dependencies.
