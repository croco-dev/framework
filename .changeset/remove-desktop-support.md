---
"@croco/cli": major
"@croco/problems-core": patch
"create-croco-app": patch
---

Remove the unreleased desktop contract and bridge-generation surface from Croco. The legacy
`croco desktop` entry point now fails with `CROCO_DESKTOP_REMOVED`, points desktop-beta users to the
last supporting repository revision, and never substitutes a web scaffold. Historical desktop
Problem codes remain registered as deprecated diagnostics without replacements. Generated SaaS
apps now execute native package-manager binaries directly during usage recovery.
