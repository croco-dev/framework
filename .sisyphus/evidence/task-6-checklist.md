# Task 6: README Drift Operations Checklist Baseline

## Drift Evidence

### Root README.md Analysis

**Found sections**:
- Project introduction with 4-layer architecture (Framework → Protocols → Transports → Integrations)
- Mermaid architecture diagram
- Package catalog table with descriptions
- Quick start guide
- Development guide with pnpm commands
- CONTRIBUTING.md link
- **Roadmap with Q2 2025, Q3 2025, Q4 2025 milestones** — potential drift indicator

### Drift Risk Areas
1. **Package catalog table** — lists packages with short descriptions; may not sync with actual `packages/*/package.json`
2. **Roadmap timestamps** — Q2/Q3/Q4 2025 dates may be stale depending on current date
3. **Package count** — stated vs actual (`packages/` contains ~85 packages, need to verify all are documented)

### Documentation Structure (Role Division)

| Document | Purpose | Update Frequency |
|----------|---------|-----------------|
| `README.md` (root) | Entry point, quick start, architecture overview, package catalog | Per release/milestone |
| `CONTRIBUTING.md` | Dev workflow, code style, testing, PR process | Per policy change |
| `packages/*/README.md` (72 found) | Package-specific API docs, usage, architecture | Per package release |
| `AGENTS.md` | AI agent conventions | Per convention change |

## Release/Milestone Checklist Design

### Pre-Release Documentation Checklist

```markdown
## Release Documentation Checklist

- [ ] README.md package catalog matches `ls packages/` output
- [ ] Root roadmap sections (Q*/YYYY milestones) updated
- [ ] New packages have README with: overview, API surface, dependencies
- [ ] Removed packages removed from catalog table
- [ ] AGENTS.md conventions still accurate
- [ ] CONTRIBUTING.md commands still valid (pnpm setup, check, test, etc.)
```

### When to Run Checklist
- **Automated**: Pre-release PR CI step — compare README catalog with actual packages
- **Manual**: Release authoring — roadmap update, new package README creation
- **Optional automation**: Script `scripts/check-readme-catalog.mjs` (future)

## Integration with Existing CI

Current `.github/workflows/ci.yml` has:
- `docs-sync-check`
- `docs-build`  
- `docs-links`

The release checklist can be added as a **release workflow** step (not in CI, since it's release-gated, not PR-gated).

## Files to Modify
- `README.md` — drift sections update (during release)
- CONTRIBUTING.md — add checklist link to release process

## Policy Guardrails
- **NO** README full rewrite
- **NO** docs platform redesign
- Focus only on consistency maintenance mechanism

## Next Steps
1. Decide checklist location: GitHub Issue Template or CONTRIBUTING section
2. Optionally create simple comparison script for automation
