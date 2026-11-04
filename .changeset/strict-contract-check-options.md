---
"@croco/cli": patch
---

`croco contracts check` reports unknown options such as a misspelled `--strict-schemas` and exits before loading controllers. Use `--controllers=<glob>` and `--out=<path>` to pass inline values.
