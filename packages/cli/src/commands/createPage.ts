import { defineCommand } from "citty";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { normalize, validate } from "../libs/naming.js";
import { detect } from "../libs/workspace.js";
import { pageRoute } from "../templates/pageRoute.js";
import { pageTsx } from "../templates/pageTsx.js";
import { GLOBAL_OPTIONS } from "./options.js";

export type PageMode = "ssr" | "spa";

export interface RunCreatePageOptions {
  dryRun?: boolean;
  overwrite?: boolean;
  cwd?: string;
  mode?: PageMode;
  path?: string;
}

export interface RunCreatePageResult {
  name: string;
  kebab: string;
  files: WriteResult[];
}

const DEPENDENCY_FIELDS = [
  "dependencies",
  "devDependencies",
  "peerDependencies",
  "optionalDependencies",
] as const;

type DependencyField = (typeof DEPENDENCY_FIELDS)[number];
type ConsoleWebPackageManifest = Partial<Record<DependencyField, Record<string, string>>>;

export async function runCreatePage(
  name: string,
  options: RunCreatePageOptions = {},
): Promise<RunCreatePageResult | null> {
  const { dryRun = false, overwrite = false, cwd = process.cwd(), mode = "ssr" } = options;

  if (!validate(name)) {
    throw new Error(`Invalid name: ${name}`);
  }
  if (!isPageMode(mode)) {
    throw new Error(`Invalid page mode: ${mode}`);
  }

  const pageName = normalize(name, "pascal");
  const kebab = normalize(name, "kebab");
  const routePath = options.path ?? `/${kebab}`;
  const workspace = await detect(cwd);

  if (!workspace.root || !workspace.hasConsoleWeb) {
    console.log("No Croco workspace detected. Run from a Croco project.");
    return null;
  }

  const supportedModes = await detectSupportedPageModes(
    join(workspace.root, "apps", "console-web", "package.json"),
  );

  if (supportedModes && !supportedModes.includes(mode)) {
    throw new Error(
      `Page mode '${mode}' is not supported by apps/console-web. Supported modes: ${supportedModes.join(", ")}`,
    );
  }

  const pagePath = join(workspace.root, "apps", "console-web", "pages", kebab, "Page.tsx");
  const pageDir = dirname(pagePath);
  const files = await Promise.all([
    fileWriterWrite(pagePath, pageTsx({ name: pageName }), { dryRun, overwrite }),
    fileWriterWrite(join(pageDir, "route.ts"), pageRoute({ mode, path: routePath }), {
      dryRun,
      overwrite,
    }),
  ]);

  return {
    name: pageName,
    kebab,
    files,
  };
}

export const createPage = defineCommand({
  meta: {
    name: "page",
    description: "Create a console web page",
  },
  args: {
    ...GLOBAL_OPTIONS,
    name: {
      type: "positional",
      required: true,
      description: "Page name",
    },
    mode: {
      type: "string",
      default: "ssr",
      description: "Page mode: ssr or spa",
    },
    path: {
      type: "string",
      description: "Route path",
    },
  },
  async run({ args }) {
    const result = await runCreatePage(String(args.name ?? ""), {
      dryRun: Boolean(args.dryRun),
      overwrite: Boolean(args.overwrite),
      cwd: typeof args.cwd === "string" ? args.cwd : undefined,
      mode: parsePageMode(args.mode),
      path: typeof args.path === "string" ? args.path : undefined,
    });

    logWriteResults(result);
  },
});

function parsePageMode(value: unknown): PageMode {
  if (value === undefined || value === "ssr") return "ssr";
  if (value === "spa") return "spa";
  throw new Error(`Invalid page mode: ${String(value)}`);
}

function isPageMode(value: string): value is PageMode {
  return value === "ssr" || value === "spa";
}

async function detectSupportedPageModes(
  packageJsonPath: string,
): Promise<readonly PageMode[] | null> {
  const manifest = JSON.parse(
    await readFile(packageJsonPath, "utf-8"),
  ) as ConsoleWebPackageManifest;
  const hasMetaVite = hasDependency(manifest, "@croco/meta-vite");
  const hasFrontendVite = hasDependency(manifest, "@croco/frontend-vite");

  if (!hasMetaVite && !hasFrontendVite) {
    return null;
  }

  const modes: PageMode[] = [];

  if (hasMetaVite) {
    modes.push("ssr");
  }
  if (hasFrontendVite) {
    modes.push("spa");
  }

  return modes;
}

function hasDependency(manifest: ConsoleWebPackageManifest, packageName: string): boolean {
  return DEPENDENCY_FIELDS.some((field) =>
    Object.prototype.hasOwnProperty.call(manifest[field] ?? {}, packageName),
  );
}

function logWriteResults(result: RunCreatePageResult | null): void {
  if (!result) return;

  for (const file of result.files) {
    logWriteResult(file);
  }
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
