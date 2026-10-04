import { defineCommand } from "citty";
import { join } from "node:path";
import { CliError } from "../libs/CliError.js";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { getCrocoCommandRuntime, logWriteResult } from "../libs/cliRuntime.js";
import { assertGeneratedImportDependencies } from "../libs/generatedImportContract.js";
import { normalize, validate } from "../libs/naming.js";
import { detect } from "../libs/workspace.js";
import { GLOBAL_OPTIONS } from "./options.js";

export interface GenerateEventOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
}

export interface GenerateEventResult extends WriteResult {
  name: string;
  path: string;
}

export async function generateEvent(
  name: string,
  options: GenerateEventOptions = {},
): Promise<GenerateEventResult | null> {
  const { dryRun = false, overwrite = false, cwd = getCrocoCommandRuntime().cwd } = options;

  if (!validate(name)) {
    throw new CliError("CROCO_CLI_NAME_INVALID", `Invalid name: ${name}`);
  }

  const className = normalize(name, "pascal");
  const eventName = normalize(name, "kebab");
  const workspace = await detect(cwd);

  if (!workspace.root) {
    getCrocoCommandRuntime().stdout("No Croco workspace detected. Run from a Croco project.");
    return null;
  }

  if (!workspace.apiServerDir) {
    getCrocoCommandRuntime().stdout(
      "No API server app detected in apps/ (checked api-server, api, server, backend).",
    );
    return null;
  }

  const targetPath = join(
    workspace.root,
    workspace.apiServerDir,
    "src",
    "events",
    `${className}Event.ts`,
  );
  const content = `import { DomainEvent } from "@croco/events-core";

export class ${className}Event extends DomainEvent {
  static eventName = "${eventName}";

  constructor(public readonly payload: { [key: string]: unknown }) {
    super();
  }
}
`;

  await assertGeneratedImportDependencies({
    manifestPath: join(workspace.root, workspace.apiServerDir, "package.json"),
    manifestLabel: `${workspace.apiServerDir}/package.json`,
    sources: [{ path: targetPath, content }],
  });

  const result = await fileWriterWrite(targetPath, content, { dryRun, overwrite });

  return {
    ...result,
    name: className,
    path: targetPath,
  };
}

export const makeEvent = defineCommand({
  meta: {
    name: "event",
    description: "Create an event",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Event name",
    },
  },
  async run({ args }) {
    const result = await generateEvent(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
    });

    logWriteResult(result);
  },
});
