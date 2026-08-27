import { defineCommand } from "citty";
import { dirname, join } from "node:path";
import type { WriteResult } from "../libs/fileWriter.js";
import { write as fileWriterWrite } from "../libs/fileWriter.js";
import { getCrocoCommandRuntime } from "../libs/cliRuntime.js";
import {
  assertGeneratedImportDependencies,
  hasManifestDependency,
  readPackageManifest,
} from "../libs/generatedImportContract.js";
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

export async function runCreatePage(
  name: string,
  options: RunCreatePageOptions = {},
): Promise<RunCreatePageResult | null> {
  const {
    dryRun = false,
    overwrite = false,
    cwd = getCrocoCommandRuntime().cwd,
    mode = "ssr",
  } = options;

  if (!validate(name)) {
    throw new Error(`Invalid name: ${name}`);
  }
  if (!isPageMode(mode)) {
    throw new Error(`Invalid page mode: ${mode}`);
  }

  const pageName = normalize(name, "pascal");
  const kebab = normalize(name, "kebab");
  const routeUrlPath = assertPageRoutePath(options.path ?? `/${kebab}`);
  const workspace = await detect(cwd);

  if (!workspace.root || !workspace.hasConsoleWeb) {
    getCrocoCommandRuntime().stdout("No Croco workspace detected. Run from a Croco project.");
    return null;
  }

  const consoleWebManifestPath = join(workspace.root, "apps", "console-web", "package.json");
  const supportedModes = await detectSupportedPageModes(consoleWebManifestPath);

  if (supportedModes && !supportedModes.includes(mode)) {
    throw new Error(
      `Page mode '${mode}' is not supported by apps/console-web. Supported modes: ${supportedModes.join(", ")}`,
    );
  }

  const pagePath = join(workspace.root, "apps", "console-web", "pages", kebab, "Page.tsx");
  const pageDir = dirname(pagePath);
  const pageContent = pageTsx({ name: pageName });
  const routeFilePath = join(pageDir, "route.ts");
  const routeContent = pageRoute({ mode, path: routeUrlPath });

  await assertGeneratedImportDependencies({
    manifestPath: consoleWebManifestPath,
    manifestLabel: "apps/console-web/package.json",
    sources: [
      { path: pagePath, content: pageContent },
      { path: routeFilePath, content: routeContent },
    ],
  });

  const files = await Promise.all([
    fileWriterWrite(pagePath, pageContent, { dryRun, overwrite }),
    fileWriterWrite(routeFilePath, routeContent, {
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
  const manifest = await readPackageManifest(packageJsonPath);
  const hasMetaVite = hasManifestDependency(manifest, "@croco/meta-vite");
  const hasFrontendVite = hasManifestDependency(manifest, "@croco/frontend-vite");

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

function logWriteResults(result: RunCreatePageResult | null): void {
  if (!result) return;

  for (const file of result.files) {
    logWriteResult(file);
  }
}

function logWriteResult(result: WriteResult): void {
  if (result.status === "created") {
    getCrocoCommandRuntime().stdout(`Created: ${result.path}`);
  } else if (result.status === "overwritten") {
    getCrocoCommandRuntime().stdout(`Overwritten: ${result.path}`);
  } else if (result.status === "skipped-dry-run") {
    getCrocoCommandRuntime().stdout(`[Dry run] Would create: ${result.path}`);
    if (result.diff) {
      getCrocoCommandRuntime().stdout(result.diff);
    }
  } else if (result.status === "exists-no-overwrite") {
    getCrocoCommandRuntime().stdout(`Skipped (exists): ${result.path}`);
  }
}

function assertPageRoutePath(path: string): string {
  if (path.length === 0 || !path.startsWith("/")) {
    throw new InvalidPageRoutePathError(path);
  }

  return path;
}

class InvalidPageRoutePathError extends Error {
  readonly code = "CROCO_CLI_PAGE_ROUTE_PATH_INVALID";

  constructor(path: string) {
    super(`Invalid route path: ${JSON.stringify(path)}. Route paths must start with '/'.`);
    this.name = "InvalidPageRoutePathError";
  }
}
