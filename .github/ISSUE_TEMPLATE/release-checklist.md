---
name: Release Documentation Checklist
about: Pre-release documentation consistency verification
title: "Docs drift check — vX.Y.Z"
labels: [documentation, release]
---

## Pre-Release Documentation Checklist

### Root README

- [ ] Package catalog tables match `ls packages/` output
- [ ] Roadmap sections updated (no stale Q\*/YYYY dates)
- [ ] Architecture diagram still accurate
- [ ] Quick start commands still valid

### CONTRIBUTING.md

- [ ] Development workflow commands still accurate
- [ ] Code style examples up to date
- [ ] Test/run commands match package.json scripts

### Package READMEs

- [ ] New packages have READMEs with: overview, API surface, dependencies
- [ ] Deprecated/removed packages removed from catalog
