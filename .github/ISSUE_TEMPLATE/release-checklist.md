---
name: Release Documentation Checklist
about: Pre-release documentation consistency verification
title: "Docs drift check — vX.Y.Z"
labels: [documentation, release]
---

## Pre-Release Documentation Checklist

### Package Catalog Gate

- [ ] `pnpm docs:catalog:check` passes
- [ ] Review `docs/package-docs-report.md` for legacy README/API docs/test gaps

### Root README

- [ ] Roadmap sections updated (no stale Q\*/YYYY dates)
- [ ] Architecture diagram still accurate
- [ ] Quick start commands still valid

### CONTRIBUTING.md

- [ ] Development workflow commands still accurate
- [ ] Code style examples up to date
- [ ] Test/run commands match package.json scripts

### Package READMEs

- [ ] New public packages have README/API docs/test coverage or an explicit baseline entry
- [ ] Deprecated/removed packages are reflected in `docs/package-catalog.json`
