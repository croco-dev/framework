---
"@croco/frontend-react": patch
---

Published manifests no longer carry a stale semver range for the internal `@croco/meta-vite` peer; internal Croco source manifest references are checked against the workspace range policy before release.
