import { defineCommand } from "citty";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";
import { runCreateDomain } from "./createDomain.js";
import type { PageMode, RunCreatePageResult } from "./createPage.js";
import { runCreatePage } from "./createPage.js";
import { GLOBAL_OPTIONS } from "./options.js";

export interface RunGenerateScaffoldOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
  register?: boolean;
  mode?: PageMode;
}

export interface RunGenerateScaffoldResult {
  domain: Awaited<ReturnType<typeof runCreateDomain>>;
  page: RunCreatePageResult | null;
}

export async function runGenerateScaffold(
  name: string,
  options: RunGenerateScaffoldOptions = {},
): Promise<RunGenerateScaffoldResult> {
  const {
    dryRun = false,
    overwrite = false,
    cwd = getCrocoCommandRuntime().cwd,
    register = true,
    mode = "ssr",
  } = options;
  const domain = await runCreateDomain(name, { dryRun, overwrite, cwd, register });
  if (!domain) {
    throw new Error("Scaffold generation failed: domain generation failed.");
  }

  try {
    const page = await runCreatePage(name, { dryRun, overwrite, cwd, mode });
    if (!page) {
      throw new Error("page generation failed");
    }
    return { domain, page };
  } catch (error) {
    throw new Error(
      `Scaffold partially generated: domain succeeded, page failed. ${formatError(error)}`,
    );
  }
}

export const generateScaffold = defineCommand({
  meta: {
    name: "scaffold",
    description: "Generate a scaffold",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Model name",
    },
    register: {
      type: "boolean",
      default: true,
      description: "Register controller in the API server entry file",
    },
    mode: {
      type: "string",
      default: "ssr",
      description: "Page mode: ssr or spa",
    },
  },
  async run({ args }) {
    await runGenerateScaffold(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
      register: Boolean(args.register),
      mode: parsePageMode(args.mode),
    });
  },
});

function parsePageMode(value: unknown): PageMode {
  if (value === undefined || value === "ssr") return "ssr";
  if (value === "spa") return "spa";
  throw new Error(`Invalid page mode: ${String(value)}`);
}

function formatError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}
