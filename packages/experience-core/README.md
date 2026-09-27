# @croco/experience-core

Code-registered in-app placements, deterministic server decisions, and receipt
contracts for visible displays and dismissals. Define each placement with
`definePlacement({ id, schema, allowedRenderers })`; the schema declares
context fields, allowed locales, copy length limits, and whether action URLs
are allowed. Renderer names and the schema form the validation boundary for
configuration.

`evaluatePlacement` considers only published, active configurations in the exact
application, environment, tenant, and placement. It validates targeting, chooses
one match by priority and stable ID ordering, and reserves a durable decision
through `ExperienceStore`. A caller can pass the requested locale for an exact
content match. No match returns `no_match`; an unavailable published cohort
returns `unavailable` rather than being treated as empty membership.

The decision copies the selected content and any published cohort snapshot
reference. Serve that decision and its exposure handle in the server response and
hydrate with the same values. Call `recordExposure` only after the display has
actually been visible. Its server-issued handle and authenticated scope and
subject let the store reject forged or cross-scope confirmations and deduplicate
retries. Call `dismissExperience` when the user dismisses the experience.

`previewPlacement` runs the same matching rules without reserving a decision or
recording an exposure. The application must authorize configuration and preview
requests at its server boundary. A `PublishedCohortReader` supplies immutable
cohort membership; this package does not query warehouse or source facts. Cohort
membership is targeting data and must not replace authorization for checkout or
other protected actions.

Use `@croco/experience-drizzle` for PostgreSQL persistence and
`@croco/frontend-react/experience-slot` to render a server decision in React.
`examples/experience-placement` demonstrates the complete path.
