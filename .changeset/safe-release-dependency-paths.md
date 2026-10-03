---
---

Workspace-only dependency maintenance; no public package release.

Changesets 3 removes the braces dependency paths from release tooling. The pinned
assemble-release-plan patch preserves Changesets 2's automatic major releases for
peer dependents. Remove the patch only when upstream supports an equivalent
configurable policy; see [Changesets #2090](https://github.com/changesets/changesets/pull/2090).

Use busboy 3.2.1 for affected workspace runtime dependencies. Audit classifications
and suppressions remain unchanged.
