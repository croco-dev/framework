---
name: croco
description: Inspect and modify Croco applications through canonical contracts, plugins, profiles, composition metadata, and executable examples. Use for adding or replacing Croco capabilities without legacy global wiring.
---

# Croco application composition

Start from the application's evidence instead of guessing from package names.

Croco is an integrated framework for product growth: low-level APIs, policy-aware UI and operations tools, and inspectable contracts for coding agents. Use the [architecture guide](https://github.com/croco-dev/framework/blob/trunk/packages/docs/src/content/docs/en/guides/architecture.mdx) for current capabilities and target direction. Simplifying wiring does not authorize deleting decorators, SSR, native protocols, or domain policy.

1. Run `node .agents/skills/croco/scripts/inspect-croco-project.mjs .` in a generated project or framework checkout.
2. Read the reported manifests, package scripts, Croco dependencies, and composition roots. If the project has no manifest for a claimed runtime or capability, treat that compatibility as unverified.
3. Map the requested capability through [package selection](references/package-selection.md). Confirm contract, runtime compatibility, maturity, certification, required configuration, and the linked executable example before editing.
4. Follow the canonical Profile → Application module → Host/Transport path in [architecture](references/architecture.md) and [plugin composition](references/plugins.md). Declare decorated components through constructors and required injection tokens; let the compiler generate their factories and registration graph. Keep scan roots, plugin selection, module visibility, and ambiguous bindings explicit.
5. Run the change-specific checks in [verification](references/verification.md). Report unverified, alpha, beta, uncertified, or runtime-unclaimed paths explicitly.

Use a compatible first-party plugin when one satisfies the contract and runtime. Do not replace it with a custom core adapter merely for convenience. When no suitable implementation exists, keep application code on the core contract, put the adapter in an application-owned module, and state the unsupported or immature boundary. See [recipes](references/recipes.md).

Never select duplicate providers by import or registration order. Use `providerReplacements` with the exact owner set when replacement is intentional. Do not introduce direct `Container.set()` composition, package-specific global setters, raw transport arrays, or direct telemetry singleton initialization when a canonical plugin/module exists.

For data and measurement work, follow the [data recipe](references/recipes.md#data-and-measurement). Reuse the existing parser, provider reader, metric runner, and quality contracts. Distinguish source-verified implementation, target design, local test evidence, provider certification, and release evidence; an issue or merged PR alone does not establish all five.

For historical targeting comparisons, follow the [targeting replay recipe](references/recipes.md#historical-targeting-replay) for pure calculation, authorized campaign history reads, private report storage, and the aggregate Inspector.
