import * as p from "@clack/prompts";
import pc from "picocolors";
import type { GeneratorOptions } from "./types.js";

export async function runPrompts(cliArgs: Partial<GeneratorOptions>): Promise<GeneratorOptions> {
  p.intro(pc.bgCyan(pc.black(" create-croco-app ")));

  // 1. projectName
  const projectName =
    cliArgs.projectName ??
    (await p.text({
      message: "What is the project name?",
      placeholder: "my-app",
      validate(value) {
        if (!value) return "Project name is required";
        if (!/^[a-z0-9-_]+$/.test(value))
          return "Only lowercase letters, numbers, hyphens, underscores";
        return undefined;
      },
    }));
  if (p.isCancel(projectName)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 2. scope
  const scope =
    cliArgs.scope ??
    (await p.text({
      message: "Package scope?",
      placeholder: "@myorg",
      validate(value) {
        if (value && !value.startsWith("@")) return "Scope must start with @";
        return undefined;
      },
    }));
  if (p.isCancel(scope)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 3. preset
  const preset =
    cliArgs.preset ??
    (await p.select({
      message: "Select a project preset:",
      options: [
        { value: "blank", label: "Blank", hint: "Empty monorepo structure" },
        {
          value: "ddd-api",
          label: "DDD API",
          hint: "Basic DDD skeleton (Drizzle ORM + env utils)",
        },
        { value: "ddd-fullstack", label: "DDD Fullstack", hint: "API + Web frontend" },
        {
          value: "ddd-vike-fullstack",
          label: "DDD Vike Fullstack",
          hint: "API Worker + SSR Worker",
        },
      ],
    }));
  if (p.isCancel(preset)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // blank preset: return early with defaults
  if (preset === "blank") {
    const installDeps =
      cliArgs.installDeps ?? (await p.confirm({ message: "Install dependencies?" }));
    if (p.isCancel(installDeps)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    const initGit = cliArgs.initGit ?? (await p.confirm({ message: "Initialize git repository?" }));
    if (p.isCancel(initGit)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }

    p.outro(pc.green("✓ Project configuration complete"));
    return {
      projectName: projectName as string,
      scope: scope as string,
      preset: "blank",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: installDeps as boolean,
      initGit: initGit as boolean,
    };
  }

  // 4. webApps (fullstack only)
  let webApps: string[] = cliArgs.webApps ?? [];
  if (preset === "ddd-fullstack" && (!cliArgs.webApps || cliArgs.webApps.length === 0)) {
    const webAppsInput = await p.text({
      message: "Web app names? (comma-separated)",
      placeholder: "web",
      initialValue: "web",
    });
    if (p.isCancel(webAppsInput)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    webApps = (webAppsInput as string)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  // 5. api type
  const api =
    cliArgs.api ??
    (await p.select({
      message: "Select API type:",
      options: [
        { value: "graphql", label: "GraphQL", hint: "type-graphql + Apollo Server" },
        { value: "trpc", label: "tRPC", hint: "Type-safe RPC" },
      ],
    }));
  if (p.isCancel(api)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 6. apiHosting — 역방향 가드: webApps >= 2 → standalone 강제
  let apiHosting: "standalone" | "nextjs" = "standalone";
  if (webApps.length >= 2) {
    p.note("Multiple web apps detected — API hosting forced to Standalone", "Auto-selected");
    apiHosting = "standalone";
  } else if (preset === "ddd-fullstack" && webApps.length === 1) {
    const hostingChoice =
      cliArgs.apiHosting ??
      (await p.select({
        message: "Where to host the API?",
        options: [
          { value: "standalone", label: "Standalone", hint: "Separate API server process" },
          { value: "nextjs", label: "Next.js API Route", hint: "Bundled with web app" },
        ],
      }));
    if (p.isCancel(hostingChoice)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    apiHosting = hostingChoice as "standalone" | "nextjs";
  } else if (preset === "ddd-api" || preset === "ddd-vike-fullstack") {
    // If ddd-api preset is selected, apiHosting is standalone
    apiHosting = "standalone";
  }

  // 7. backendDeploy (standalone only)
  let backendDeploy: "docker" | "lambda" | undefined;
  if (apiHosting === "standalone") {
    const deployChoice =
      cliArgs.backendDeploy ??
      (await p.select({
        message: "Backend deployment target:",
        initialValue: "lambda",
        options: [
          { value: "docker", label: "Docker", hint: "Containerized deployment" },
          { value: "lambda", label: "AWS Lambda (SST v3)", hint: "Serverless" },
        ],
      }));
    if (p.isCancel(deployChoice)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    backendDeploy = deployChoice as "docker" | "lambda";
  }

  // 8. frontendDeploy (fullstack only)
  let frontendDeploy: "opennext" | "vercel" | "docker" | "cloudflare-meta-vite" | undefined;
  if (preset === "ddd-fullstack" || preset === "ddd-vike-fullstack") {
    const frontendChoice =
      cliArgs.frontendDeploy ??
      (await p.select({
        message: "Frontend deployment target:",
        options: [
          { value: "opennext", label: "OpenNext (Cloudflare)", hint: "Edge deployment" },
          {
            value: "cloudflare-meta-vite",
            label: "Cloudflare Meta Vite",
            hint: "SSR Worker deployment",
          },
          { value: "vercel", label: "Vercel", hint: "Vercel platform" },
          { value: "docker", label: "Docker", hint: "Containerized" },
        ],
      }));
    if (p.isCancel(frontendChoice)) {
      p.cancel("Operation cancelled");
      process.exit(0);
    }
    frontendDeploy = frontendChoice as "opennext" | "vercel" | "docker" | "cloudflare-meta-vite";
  }

  // 9. db
  const db =
    cliArgs.db && cliArgs.db.length > 0
      ? cliArgs.db
      : await p.multiselect({
          message: "Select databases:",
          options: [
            { value: "postgres", label: "PostgreSQL", hint: "Relational (Drizzle ORM)" },
            { value: "mongodb", label: "MongoDB", hint: "Document store" },
            { value: "redis", label: "Redis", hint: "Cache / pub-sub" },
          ],
          required: false,
        });
  if (p.isCancel(db)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 10. agentRules
  const agentRules =
    cliArgs.agentRules ??
    (await p.confirm({
      message: "Add AI agent rules? (.cursor/rules, AGENTS.md)",
      initialValue: true,
    }));
  if (p.isCancel(agentRules)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 11. installDeps
  const installDeps =
    cliArgs.installDeps ?? (await p.confirm({ message: "Install dependencies?" }));
  if (p.isCancel(installDeps)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  // 12. initGit
  const initGit = cliArgs.initGit ?? (await p.confirm({ message: "Initialize git repository?" }));
  if (p.isCancel(initGit)) {
    p.cancel("Operation cancelled");
    process.exit(0);
  }

  p.outro(pc.green("✓ Project configuration complete"));

  return {
    projectName: projectName as string,
    scope: scope as string,
    preset: preset as GeneratorOptions["preset"],
    webApps,
    api: api as GeneratorOptions["api"],
    apiHosting,
    backendDeploy,
    frontendDeploy,
    db: db as GeneratorOptions["db"],
    agentRules: agentRules as boolean,
    installDeps: installDeps as boolean,
    initGit: initGit as boolean,
  };
}
