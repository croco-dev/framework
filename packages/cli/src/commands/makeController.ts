import { defineCommand } from "citty";
import { join } from "node:path";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { getCrocoCommandRuntime, logWriteResult } from "../libs/cliRuntime.js";
import { assertGeneratedImportDependencies } from "../libs/generatedImportContract.js";
import { normalize, validate } from "../libs/naming.js";
import { detect } from "../libs/workspace.js";
import { GLOBAL_OPTIONS } from "./options.js";

export interface GenerateControllerOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
}

export interface GenerateControllerResult extends WriteResult {
  name: string;
  path: string;
}

export async function generateController(
  name: string,
  options: GenerateControllerOptions = {},
): Promise<GenerateControllerResult | null> {
  const { dryRun = false, overwrite = false, cwd = getCrocoCommandRuntime().cwd } = options;

  if (!validate(name)) {
    throw new Error(`Invalid name: ${name}`);
  }

  const className = normalize(name, "pascal");
  const routeName = normalize(name, "kebab");
  const workspace = await detect(cwd);

  if (!workspace.root || !workspace.hasApiServer) {
    getCrocoCommandRuntime().stdout("No Croco workspace detected. Run from a Croco project.");
    return null;
  }

  const targetPath = join(
    workspace.root,
    "apps",
    "api-server",
    "src",
    "controllers",
    `${className}Controller.ts`,
  );
  const content = `import { Controller, Ctx, Get, Post, Put, Delete } from "@croco/protocols-rest";
import type { CrocoHttpContext } from "@croco/transports-http";

@Controller("/${routeName}")
export class ${className}Controller {
  @Post("/")
  async create(@Ctx() ctx: CrocoHttpContext): Promise<unknown> {
    void ctx;
    return {};
  }

  @Get("/")
  async findAll(@Ctx() ctx: CrocoHttpContext): Promise<unknown[]> {
    void ctx;
    return [];
  }

  @Get("/:id")
  async findById(@Ctx() ctx: CrocoHttpContext): Promise<unknown> {
    void ctx;
    return {};
  }

  @Put("/:id")
  async update(@Ctx() ctx: CrocoHttpContext): Promise<unknown> {
    void ctx;
    return {};
  }

  @Delete("/:id")
  async delete(@Ctx() ctx: CrocoHttpContext): Promise<void> {
    void ctx;
  }
}
`;

  await assertGeneratedImportDependencies({
    manifestPath: join(workspace.root, "apps", "api-server", "package.json"),
    manifestLabel: "apps/api-server/package.json",
    sources: [{ path: targetPath, content }],
  });

  const result = await fileWriterWrite(targetPath, content, { dryRun, overwrite });

  return {
    ...result,
    name: className,
    path: targetPath,
  };
}

export const makeController = defineCommand({
  meta: {
    name: "controller",
    description: "Create a controller",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Controller name",
    },
  },
  async run({ args }) {
    const result = await generateController(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
    });

    logWriteResult(result);
  },
});
