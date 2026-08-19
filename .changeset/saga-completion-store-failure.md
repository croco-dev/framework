---
"@croco/workflow-core": minor
"@croco/problems-core": patch
---

- fix(workflow-core): classify final saga completion store failures distinctly from business step failures so successful work is never compensated

- chore(problems-core): register the workflow-core saga finalization problem code
