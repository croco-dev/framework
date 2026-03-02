import { join } from 'node:path';
import { mergeInto } from '../helpers/fs.js';
import type { GeneratorOptions } from '../types.js';

const TEMPLATES_DIR = new URL('../../templates', import.meta.url).pathname;

export function installWebTrpc(
  targetDir: string,
  webAppName: string,
  options: Pick<GeneratorOptions, 'projectName' | 'scope'>
): void {
  const addonDir = join(TEMPLATES_DIR, 'addons/web-trpc');
  const appTargetDir = join(targetDir, 'apps', webAppName);
  mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
}
