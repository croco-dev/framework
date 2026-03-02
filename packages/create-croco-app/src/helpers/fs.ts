import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import fsExtra from 'fs-extra';

const { copySync, ensureDirSync, readFileSync, writeFileSync } = fsExtra;

import Handlebars from 'handlebars';

export function copyTemplate(src: string, dest: string): void {
  copySync(src, dest, { overwrite: true });
}

export function renderHandlebars(templatePath: string, context: Record<string, unknown>): string {
  const template = readFileSync(templatePath, 'utf-8');
  return Handlebars.compile(template)(context);
}

export function mergeInto(src: string, dest: string, context: Record<string, unknown>): void {
  ensureDirSync(dest);
  const entries = readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destName = entry.name.replace(/\.hbs$/, '');
    const destPath = join(dest, destName);
    if (entry.isDirectory()) {
      mergeInto(srcPath, destPath, context);
    } else if (entry.name.endsWith('.hbs')) {
      writeFileSync(destPath, renderHandlebars(srcPath, context));
    } else {
      copySync(srcPath, destPath, { overwrite: false });
    }
  }
}
