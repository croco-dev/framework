---
name: croco
description: Inspect and modify Croco applications through canonical contracts, plugins, profiles, composition metadata, and executable examples. Use for adding or replacing Croco capabilities without legacy global wiring.
---

# Croco application composition

Start from the application's evidence instead of guessing from package names.

1. Run `node .agents/skills/croco/scripts/inspect-croco-project.mjs .` in a generated project or framework checkout.
2. Read the reported manifests, package scripts, Croco dependencies, and composition roots. If the project has no manifest for a claimed runtime or capability, treat that compatibility as unverified.
3. Map the requested capability through [package selection](references/package-selection.md). Confirm contract, runtime compatibility, maturity, certification, required configuration, and the linked executable example before editing.
4. Follow the canonical Profile → Application module → Host/Transport path in [architecture](references/architecture.md) and [plugin composition](references/plugins.md). Add the selected plugin or application adapter to the explicit composition root.
5. Run the change-specific checks in [verification](references/verification.md). Report unverified, alpha, beta, uncertified, or runtime-unclaimed paths explicitly.

Use a compatible first-party plugin when one satisfies the contract and runtime. Do not replace it with a custom core adapter merely for convenience. When no suitable implementation exists, keep application code on the core contract, put the adapter in an application-owned module, and state the unsupported or immature boundary. See [recipes](references/recipes.md).

Never select duplicate providers by import or registration order. Use `providerReplacements` with the exact owner set when replacement is intentional. Do not introduce direct `Container.set()` composition, package-specific global setters, raw transport arrays, or direct telemetry singleton initialization when a canonical plugin/module exists.
