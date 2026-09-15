# Public API Surface Report

- Status: pass
- Packages scanned: 120
- Packages with API drift: 0
- Entrypoints with drift: 0
- Snapshot: `public-api-surface.snapshot.json`
- Update command: `pnpm public-api:write`
- CI guard: `pnpm public-api:check` runs through `pnpm check`.
- Release review: runtime or type export changes in publishable packages must be intentional. Pair the snapshot update with a changeset when the package's public behavior, types, or import surface changes.

## Diff Totals
| Surface | Added | Removed |
| --- | ---: | ---: |
| runtime exports | 0 | 0 |
| type exports | 0 | 0 |
| entrypoints | 0 | 0 |
| target records changed | 0 | 0 |

## Package Diffs
- none
