---
"@croco/meta-vite": patch
"create-croco-app": patch
---

Meta-Vite and generated Meta-Vite applications now require Vite `>=6.4.3 <7`, excluding the Windows
development-server filesystem deny bypass fixed in Vite 6.4.3.
