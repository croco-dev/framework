import { defineCommand } from "citty";
import { join } from "node:path";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { assertGeneratedImportDependencies } from "../libs/generatedImportContract.js";
import { normalize, validate } from "../libs/naming.js";
import { detect } from "../libs/workspace.js";
import { GLOBAL_OPTIONS } from "./options.js";

export interface GenerateRepositoryOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
}

export interface GenerateRepositoryResult extends WriteResult {
  name: string;
  path: string;
}

export async function generateRepository(
  name: string,
  options: GenerateRepositoryOptions = {},
): Promise<GenerateRepositoryResult | null> {
  const { dryRun = false, overwrite = false, cwd = process.cwd() } = options;

  if (!validate(name)) {
    throw new Error(`Invalid name: ${name}`);
  }

  const className = normalize(name, "pascal");
  const workspace = await detect(cwd);

  if (!workspace.root || !workspace.hasApiServer) {
    console.log("No Croco workspace detected. Run from a Croco project.");
    return null;
  }

  const targetPath = join(
    workspace.root,
    "apps",
    "api-server",
    "src",
    "repositories",
    `${className}Repository.ts`,
  );
  const content = `import type { Repository } from "@croco/repository-core";
import type { ${className}Entity } from "../entities/${className}Entity";

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

export const makeRepository = defineCommand({
  meta: {
    name: "repository",
    description: "Create a repository",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Repository name",
    },
  },
  async run({ args }) {
    const result = await generateRepository(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
    });

    logWriteResult(result);
  },
});

function logWriteResult(result: GenerateRepositoryResult | null): void {
  if (!result) return;

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
