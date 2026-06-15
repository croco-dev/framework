import { defineCommand } from "citty";
import { join } from "node:path";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { assertGeneratedImportDependencies } from "../libs/generatedImportContract.js";
import { normalize, validate } from "../libs/naming.js";
import { detect } from "../libs/workspace.js";
import { GLOBAL_OPTIONS } from "./options.js";

export interface GenerateListenerOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
}

export interface GenerateListenerResult extends WriteResult {
  name: string;
  path: string;
}

export async function generateListener(
  name: string,
  options: GenerateListenerOptions = {},
): Promise<GenerateListenerResult | null> {
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
    "listeners",
    `${className}Listener.ts`,
  );
  const content = `import { RegisterEventHandler } from "@croco/events-core";
import type { EventHandler } from "@croco/events-core";
import { ${className}Event } from "../events/${className}Event";

@RegisterEventHandler(${className}Event)
export class ${className}Listener implements EventHandler<${className}Event> {
  handle(event: ${className}Event): void {
    void event;
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

export const makeListener = defineCommand({
  meta: {
    name: "listener",
    description: "Create a listener",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Listener name",
    },
  },
  async run({ args }) {
    const result = await generateListener(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
    });

    logWriteResult(result);
  },
});

function logWriteResult(result: GenerateListenerResult | null): void {
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
