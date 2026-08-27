import { beforeEach, describe, expect, it, vi } from "vitest";
import { InvalidCliOptionProblem } from "../libs/problems/InvalidCliOptionProblem.js";
import { runPrompts } from "../prompts.js";
import type { GeneratorOptions } from "../types.js";

const promptMocks = vi.hoisted(() => ({
  cancel: vi.fn(),
  intro: vi.fn(),
  isCancel: vi.fn(() => false),
  note: vi.fn(),
  outro: vi.fn(),
  text: vi.fn(),
}));

vi.mock("@clack/prompts", () => promptMocks);

describe("GeneratorOptions type", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it.each([
    ["web,,admin", "Web app names cannot contain empty entries"],
    ["", "Web app names cannot contain empty entries"],
  ])(
    "rejects invalid interactive web app input %j with a stable Problem",
    async (input, detail) => {
      promptMocks.text.mockResolvedValueOnce(input);

      const result = runPrompts({
        projectName: "interactive-app",
        scope: "@myorg",
        preset: "ddd-fullstack",
        api: "graphql",
        apiHosting: "standalone",
        backendDeploy: "lambda",
        frontendDeploy: "vercel",
        db: ["postgres"],
        agentRules: false,
        installDeps: false,
        initGit: false,
      });

      await expect(result).rejects.toBeInstanceOf(InvalidCliOptionProblem);
      await expect(result).rejects.toMatchObject({
        code: "create-croco-app/invalid-cli-option",
        detail,
        extensions: { option: "--web-apps" },
      });
    },
  );

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
