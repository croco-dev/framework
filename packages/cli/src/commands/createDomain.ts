import { defineCommand } from "citty";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { registerController } from "../libs/codemods/registerController.js";
import type { RegisterControllerResult } from "../libs/codemods/registerController.js";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { assertGeneratedImportDependencies } from "../libs/generatedImportContract.js";
import { normalize, validate } from "../libs/naming.js";
import { detect } from "../libs/workspace.js";
import { GLOBAL_OPTIONS } from "./options.js";

export interface RunCreateDomainOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
  register?: boolean;
}

export interface RunCreateDomainResult {
  name: string;
  kebab: string;
  files: WriteResult[];
  registration: RegisterControllerResult | null;
}

export async function runCreateDomain(
  name: string,
  options: RunCreateDomainOptions = {},
): Promise<RunCreateDomainResult | null> {
  const { dryRun = false, overwrite = false, cwd = process.cwd(), register = true } = options;

  if (!validate(name)) {
    throw new Error(`Invalid name: ${name}`);
  }

  const className = normalize(name, "pascal");
  const kebab = normalize(name, "kebab");
  const workspace = await detect(cwd);

  if (!workspace.root || !workspace.hasApiServer) {
    console.log("No Croco workspace detected. Run from a Croco project.");
    return null;
  }

  const barrelPath = join(
    workspace.root,
    "apps",
    "api-server",
    "src",
    "domains",
    kebab,
    "index.ts",
  );
  const domainDir = dirname(barrelPath);
  const generatedSources = [
    {
      path: join(domainDir, `${className}Controller.ts`),
      content: controllerTemplate(className, kebab),
    },
    {
      path: join(domainDir, `${className}Service.ts`),
      content: serviceTemplate(className),
    },
    {
      path: join(domainDir, `${className}Repository.ts`),
      content: repositoryTemplate(className),
    },
    {
      path: join(domainDir, `${className}Entity.ts`),
      content: entityTemplate(className),
    },
    {
      path: barrelPath,
      content: barrelTemplate(className),
    },
  ];

  await assertGeneratedImportDependencies({
    manifestPath: join(workspace.root, "apps", "api-server", "package.json"),
    manifestLabel: "apps/api-server/package.json",
    sources: generatedSources,
  });

  const files = await Promise.all(
    generatedSources.map((source) =>
      fileWriterWrite(source.path, source.content, {
        dryRun,
        overwrite,
      }),
    ),
  );

  const apiServerSrc = join(workspace.root, "apps", "api-server", "src");
  const indexPath = join(apiServerSrc, "index.ts");
  const entryPath = existsSync(indexPath) ? indexPath : join(apiServerSrc, "app.ts");
  const registration = register
    ? await registerController({
        entryPath,
        importPath: `./domains/${kebab}/${className}Controller`,
        className: `${className}Controller`,
        dryRun,
      })
    : null;

  return {
    name: className,
    kebab,
    files,
    registration,
  };
}

export const createDomain = defineCommand({
  meta: {
    name: "domain",
    description: "Create an API server domain",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Domain name",
    },
    register: {
      type: "boolean",
      default: true,
      description: "Register controller in the API server entry file",
    },
  },
  async run({ args }) {
    const result = await runCreateDomain(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
      register: Boolean(args.register),
    });

    logCreateDomainResult(result);
  },
});

function controllerTemplate(className: string, kebab: string): string {
  return `import { Controller, Ctx, Get, Post, Put, Delete } from "@croco/protocols-rest";
import type { CrocoHttpContext } from "@croco/transports-http";

@Controller("/${kebab}")
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
}

function serviceTemplate(className: string): string {
  return `import { Service } from "typedi";

@Service()
export class ${className}Service {
  // Business logic methods
}
`;
}

function repositoryTemplate(className: string): string {
  return `import type { Repository } from "@croco/repository-core";
import type { ${className}Entity } from "./${className}Entity";

export class ${className}Repository implements Repository<${className}Entity, string> {
  async findById(id: string): Promise<${className}Entity | null> {
    void id;
    return null;
  }

  async findByIds(ids: readonly string[]): Promise<ReadonlyArray<${className}Entity>> {
    void ids;
    return [];
  }

  async save(entity: ${className}Entity): Promise<${className}Entity> {
    return entity;
  }

  async deleteById(id: string): Promise<void> {
    void id;
  }
}
`;
}

function entityTemplate(className: string): string {
  return `export class ${className}Entity {
  id!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
`;
}

function barrelTemplate(className: string): string {
  return `export { ${className}Controller } from "./${className}Controller";
export { ${className}Service } from "./${className}Service";
export { ${className}Repository } from "./${className}Repository";
export { ${className}Entity } from "./${className}Entity";
`;
}

function logCreateDomainResult(result: RunCreateDomainResult | null): void {
  if (!result) return;

  for (const file of result.files) {
    logWriteResult(file);
  }

  logRegistrationResult(result.registration);
}

function logWriteResult(result: WriteResult): void {
  if (result.status === "created") {
    console.log(`Created: ${result.path}`);
  } else if (result.status === "overwritten") {
    console.log(`Overwritten: ${result.path}`);
  } else if (result.status === "skipped-dry-run") {
    console.log(`[Dry run] Would create: ${result.path}`);
    if (result.diff) {
      console.log(result.diff);
    }
  } else if (result.status === "exists-no-overwrite") {
    console.log(`Skipped (exists): ${result.path}`);
  }
}

function logRegistrationResult(result: RegisterControllerResult | null): void {
  if (!result) return;

  if (result.status === "unsupported-pattern") {
    console.log(`Skipped controller registration: ${result.hint}`);
    return;
  }

  console.log(`Registered controller: ${result.className}`);
}
