import { join } from 'node:path';
import { mergeInto } from '../helpers/fs.js';
import type { GeneratorOptions } from '../types.js';

const TEMPLATES_DIR = new URL('../../templates', import.meta.url).pathname;

export function installFrontendDeploy(
  targetDir: string,
  webAppName: string,
  options: Pick<GeneratorOptions, 'projectName' | 'scope' | 'frontendDeploy'>
): void {
  if (!options.frontendDeploy) return;
  const addonKey = `frontend-${options.frontendDeploy}`;
  const addonDir = join(TEMPLATES_DIR, 'addons', addonKey);
  const appTargetDir = join(targetDir, 'apps', webAppName);
  mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
}
