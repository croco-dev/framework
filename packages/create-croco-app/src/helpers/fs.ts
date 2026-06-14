import { existsSync, readdirSync } from "node:fs";
import { basename, extname, join } from "node:path";
import fsExtra from "fs-extra";

const { copySync, ensureDirSync, readFileSync, writeFileSync } = fsExtra;

import Handlebars from "handlebars";

const TEXT_TEMPLATE_EXTENSIONS = new Set([
  ".css",
  ".env",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".md",
  ".mdc",
  ".mts",
  ".ts",
  ".tsx",
  ".toml",
  ".txt",
  ".yaml",
  ".yml",
]);

const TEXT_TEMPLATE_FILENAMES = new Set([".dockerignore", ".env.example", "Dockerfile"]);

export function copyTemplate(src: string, dest: string): void {
  copySync(src, dest, { overwrite: true });
}

export function renderHandlebars(templatePath: string, context: Record<string, unknown>): string {
  const template = readFileSync(templatePath, "utf-8");
  return Handlebars.compile(template)(context);
}

function isTextTemplateCandidate(fileName: string): boolean {
  if (TEXT_TEMPLATE_FILENAMES.has(basename(fileName))) {
    return true;
  }

  if (basename(fileName).startsWith("Dockerfile.")) {
    return true;
  }

  return TEXT_TEMPLATE_EXTENSIONS.has(extname(fileName));
}

function renderTextTemplateIfNeeded(
  templatePath: string,
  context: Record<string, unknown>,
): string | null {
  const template = readFileSync(templatePath, "utf-8");

  if (!template.includes("{{") || !template.includes("}}")) {
    return null;
  }

  return Handlebars.compile(template)(context);
}

export function mergeInto(src: string, dest: string, context: Record<string, unknown>): void {
  ensureDirSync(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destName = entry.name.replace(/\.hbs$/, "");
    const destPath = join(dest, destName);
    if (entry.isDirectory()) {
      mergeInto(srcPath, destPath, context);
    } else if (entry.name.endsWith(".hbs")) {
      writeFileSync(destPath, renderHandlebars(srcPath, context));
    } else if (isTextTemplateCandidate(entry.name)) {
      const rendered = renderTextTemplateIfNeeded(srcPath, context);

      if (rendered === null) {
        copySync(srcPath, destPath, { overwrite: false });
      } else if (!existsSync(destPath)) {
        writeFileSync(destPath, rendered);
      }
    } else {
      copySync(srcPath, destPath, { overwrite: false });
    }
  }
}
