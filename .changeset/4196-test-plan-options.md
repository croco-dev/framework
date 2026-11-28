---
"@croco/cli": patch
---

`croco test plan` rejects unknown options and values attached to `--enforce` before planning. Options that take values accept both space-separated and `--name=value` forms.
