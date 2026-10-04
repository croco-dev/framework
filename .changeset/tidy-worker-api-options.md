---
"create-croco-app": patch
---

Skip the API type prompt for ddd-vike-fullstack and reject its unsupported --api option in CLI and programmatic options. The preset's GeneratorOptions type no longer accepts an API type; ddd-api and ddd-fullstack keep their protocol selection.
