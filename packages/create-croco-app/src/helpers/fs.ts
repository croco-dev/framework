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

export function replaceGithubExpressions(
  content: string,
  replacer: (expression: string) => string,
): string {
  let cursor = 0;
  let result = "";

  while (cursor < content.length) {
    const start = content.indexOf("${{", cursor);
    if (start === -1) {
      return result + content.slice(cursor);
    }

    let quote: "'" | '"' | null = null;
    let escaped = false;
    let end = -1;

    for (let index = start + 3; index < content.length; index += 1) {
      const character = content[index];

      if (quote !== null) {
        if (escaped) {
          escaped = false;
        } else if (character === "\\") {
          escaped = true;
        } else if (character === quote) {
          quote = null;
        }
      } else if (character === "'" || character === '"') {
        quote = character;
      } else if (character === "}" && content[index + 1] === "}") {
        end = index + 2;
        break;
      }
    }

    if (end === -1) {
      return result + content.slice(cursor);
    }

    result += content.slice(cursor, start);
    result += replacer(content.slice(start, end));
    cursor = end;
  }

  return result;
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
  const githubExpressions: string[] = [];
  const protectedTemplate = replaceGithubExpressions(template, (expression) => {
    const index = githubExpressions.push(expression) - 1;
    return `__CROCO_GITHUB_EXPRESSION_${index}__`;
  });

  if (!protectedTemplate.includes("{{") || !protectedTemplate.includes("}}")) {
    return null;
  }

  return Handlebars.compile(protectedTemplate)(context).replace(
    /__CROCO_GITHUB_EXPRESSION_(\d+)__/g,
    (_match, index: string) => githubExpressions[Number(index)] ?? "",
  );
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
