# AI Agent Rules Index

This project uses structured AI agent rules to maintain code quality and consistency.

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
