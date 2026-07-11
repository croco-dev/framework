import { describe, expect, it } from "vitest";
import { runPrompts } from "../prompts.js";
import type { GeneratorOptions } from "../types.js";

describe("GeneratorOptions type", () => {
  it("should accept valid blank preset options", () => {
    const opts: GeneratorOptions = {
      projectName: "my-app",
      scope: "@myorg",
      preset: "blank",
      webApps: [],
      apiHosting: "standalone",
      db: [],
      agentRules: false,
      installDeps: true,
      initGit: true,
    };
    expect(opts.preset).toBe("blank");
  });

  it("should accept valid ddd-fullstack options", () => {
    const opts: GeneratorOptions = {
      projectName: "fullstack-app",
      scope: "@myorg",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "nextjs",
      frontendDeploy: "vercel",
      db: ["postgres"],
      agentRules: true,
      installDeps: true,
      initGit: true,
    };
    expect(opts.webApps).toHaveLength(1);
  });

  it("should accept vite-spa frontend deploy option", () => {
    const opts: GeneratorOptions = {
      projectName: "spa-app",
      scope: "@myorg",
      preset: "blank",
      webApps: ["web"],
      apiHosting: "standalone",
      frontendDeploy: "vite-spa",
      db: [],
      agentRules: false,
      installDeps: true,
      initGit: true,
    };
    expect(opts.frontendDeploy).toBe("vite-spa");
  });

  it("should accept an explicit Astryx UI profile", () => {
    const opts: GeneratorOptions = {
      projectName: "astryx-spa",
      scope: "@myorg",
      preset: "ddd-fullstack",
      webApps: ["web"],
      api: "graphql",
      apiHosting: "standalone",
      frontendDeploy: "vite-spa",
      ui: "astryx",
      db: [],
      agentRules: false,
      installDeps: true,
      initGit: true,
    };

    expect(opts.ui).toBe("astryx");
  });

  it("should reject an explicit UI profile for an incompatible interactive runtime", async () => {
    await expect(
      runPrompts({
        projectName: "astryx-worker",
        scope: "@myorg",
        preset: "ddd-fullstack",
        webApps: ["web"],
        api: "graphql",
        apiHosting: "standalone",
        backendDeploy: "lambda",
        frontendDeploy: "cloudflare-meta-vite",
        ui: "astryx",
        db: [],
        agentRules: false,
        installDeps: false,
        initGit: false,
      }),
    ).rejects.toThrow("--ui is currently only supported with --frontend-deploy vite-spa");
  });
});
