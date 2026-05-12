import { describe, expect, it } from "vitest";
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
});
