import { defineCommand } from "citty";
import { join } from "node:path";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { getCrocoCommandRuntime, logWriteResult } from "../libs/cliRuntime.js";
import { normalize, validate } from "../libs/naming.js";
import { detect } from "../libs/workspace.js";
import { GLOBAL_OPTIONS } from "./options.js";

export interface GenerateEntityOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
}

export interface GenerateEntityResult extends WriteResult {
  name: string;
  path: string;
}

export async function generateEntity(
  name: string,
  options: GenerateEntityOptions = {},
): Promise<GenerateEntityResult | null> {
  const { dryRun = false, overwrite = false, cwd = getCrocoCommandRuntime().cwd } = options;

  if (!validate(name)) {
    throw new Error(`Invalid name: ${name}`);
  }

  const className = normalize(name, "pascal");
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
    "entities",
    `${className}Entity.ts`,
  );
  const content = `export class ${className}Entity {
  id!: string;
  createdAt!: Date;
  updatedAt!: Date;
}
`;

  const result = await fileWriterWrite(targetPath, content, { dryRun, overwrite });

  return {
    ...result,
    name: className,
    path: targetPath,
  };
}

export const makeEntity = defineCommand({
  meta: {
    name: "entity",
    description: "Create an entity",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Entity name",
    },
  },
  async run({ args }) {
    const result = await generateEntity(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
    });

    logWriteResult(result);
  },
});
