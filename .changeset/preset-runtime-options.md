---
"@croco/preset-lambda": patch
"@croco/preset-node": patch
---

Preset factories no longer advertise runtime options that they cannot apply; Node server options remain on `createNodeEntry`, where they affect server startup.
