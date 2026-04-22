# Task 9: DX Checklist / Docs Drift Operations Plan

## Integration of Task 6 Results

### Selected Linkage Mechanism

**Decision**: Release Checklist (GitHub Issue Template)

Among the options (PR checklist, release checklist, CI step), the **Release Checklist** is optimal because:
1. Documentation drift happens gradually — per-PR checks are too granular
2. Release is the natural synchronization point with reality
3. GitHub Issue Template provides structured tracking without CI overhead

### Checklist Location & Format

**Location**: `.github/ISSUE_TEMPLATE/release-checklist.md`

```markdown
---
name: Release Documentation Checklist
about: Pre-release documentation consistency verification
title: 'Docs drift check — vX.Y.Z'
labels: [documentation, release]
---

## Pre-Release Documentation Checklist

### Root README
- [ ] Package catalog tables match `ls packages/` output
- [ ] Roadmap sections updated (no stale Q*/YYYY dates)
- [ ] Architecture diagram still accurate
- [ ] Quick start commands still valid

### CONTRIBUTING.md
- [ ] Development workflow commands still accurate
- [ ] Code style examples up to date
- [ ] Test/run commands match package.json scripts

### Package READMEs
- [ ] New packages have READMEs with: overview, API surface, dependencies
- [ ] Deprecated/removed packages removed from catalog
```

### Role Division Documentation

**Decision**: Add to CONTRIBUTING.md as a "Documentation Architecture" section:

```markdown
## Documentation Architecture

| Document | Purpose | Update Trigger |
|----------|---------|---------------|
| `README.md` | Entry point, architecture overview, package catalog | Per release/milestone |
| `CONTRIBUTING.md` | Development workflow, code style, testing guide | Per policy change |
| `packages/*/README.md` | Package-specific API docs, usage examples | Per package release |
| `AGENTS.md` | AI coding agent conventions | Per convention change |
```

### Manual vs Automated Scope

| Check Type | Mode | Rationale |
|------------|------|-----------|
| Catalog vs actual packages | **Semi-automated** (future script) | Easy to script, compare ls vs markdown table |
| Roadmap date freshness | **Manual** (release checklist) | Requires judgment on milestone status |
| Package README existence | **Semi-automated** (check for missing READMEs) | Easy to automate |
| Content accuracy | **Manual** (author review) | Requires technical review |

### Next Steps

1. Create `.github/ISSUE_TEMPLATE/release-checklist.md`
2. Add "Documentation Architecture" section to CONTRIBUTING.md
3. (Optional future) Create `scripts/check-doc-consistency.mjs` for catalog comparison

### Files to Modify
- `.github/ISSUE_TEMPLATE/release-checklist.md` — new file
- `CONTRIBUTING.md` — add Documentation Architecture section
