---
"@croco/meta-vite": patch
"@croco/frontend-react": patch
---

Use a patched React Server Components stack for the Node Flight path and require patched optional RSC peers in published installs. Update the Vite RSC plugin as well as the standalone React Flight codec to address GHSA-xqc2-xf4c-x3h3. RSC consumers should update React and React DOM together with their Flight codec.
