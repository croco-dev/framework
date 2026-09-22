# AI Agent Rules Index

Use the repository Skill at `.agents/skills/croco/SKILL.md` when selecting, adding, replacing, or
verifying Croco contracts, plugins, profiles, transports, or hosts. It is generated from Croco's
canonical package metadata and links to executable composition examples.

Inspect the project before changing composition. Depending on the selected preset, the relevant
machine-readable inputs include `croco.arch.json`, `croco-runtime-capability.manifest.json`,
`croco-saas-profile.manifest.json`, and `croco.app.json`. Their absence means that claim is not
available for this generated project; it does not imply universal runtime or provider support.

## Rule Files

| File                     | Scope    | Description                   |
| ------------------------ | -------- | ----------------------------- |
| 000-core-architecture    | Global   | DDD architecture constraints  |
| 100-client-development   | Frontend | React/Next.js guidelines      |
| 110-frontend-performance | Frontend | Performance optimization      |
| 200-server-development   | Backend  | API design patterns           |
| 210-backend-performance  | Backend  | Database/caching optimization |
| 300-package-management   | Global   | pnpm workspace rules          |
| 400-code-quality         | Global   | TypeScript/naming conventions |
| 410-backend-testing      | Tests    | Vitest patterns               |
| 500-styling-system       | UI       | Tailwind/component library    |

## Usage

Rules in `.cursor/rules/` are used by Cursor IDE.
Rules in `.agent/rules/` are used by other AI coding agents.
