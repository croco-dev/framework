---
"@croco/cli": patch
"@croco/diagnostics-core": patch
"@croco/framework-context": patch
"@croco/preset-cloudflare": patch
"@croco/testing": patch
"@croco/transports-cloudflare-workers": patch
"@croco/transports-http": patch
"create-croco-app": patch
---

- Runtime capability manifests can now be emitted and compared for Node, Lambda, and Cloudflare Workers with deterministic `RuntimeCapabilityManifest v1` output.
- Unsupported runtime capability use now carries the stable `CROCO_RUNTIME_CAPABILITY_001` diagnostic context.
- Generated apps now write `croco-runtime-capability.manifest.json`, and doctor/smoke checks validate the manifest for supported runtime targets.
