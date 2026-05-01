import { join } from 'node:path';
import { mergeInto } from '../helpers/fs.js';
import type { GeneratorOptions } from '../types.js';

const TEMPLATES_DIR = new URL('../../templates', import.meta.url).pathname;

export function installFrontendDeploy(
  targetDir: string,
  webAppName: string | undefined,
  options: Pick<GeneratorOptions, 'projectName' | 'scope' | 'preset' | 'frontendDeploy'>
): void {
  if (!options.frontendDeploy) return;

  const appTargetDir = join(targetDir, 'apps', webAppName ?? 'web');

  if (options.frontendDeploy === 'vite-spa') {
    const addonDir = join(TEMPLATES_DIR, 'addons', 'frontend-vite-spa');
    mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
    return;
  }

  if (options.frontendDeploy === 'cloudflare-vike') {
    const addonDir =
      options.preset === 'ddd-vike-fullstack'
        ? join(TEMPLATES_DIR, 'addons', 'web-vike-fullstack')
        : join(TEMPLATES_DIR, 'addons', 'web-vike');
    const installTargetDir =
      options.preset === 'ddd-vike-fullstack' ? targetDir : join(targetDir, 'apps', webAppName ?? 'web');

    mergeInto(addonDir, installTargetDir, { projectName: options.projectName, scope: options.scope });
    return;
  }

  const addonKey = `frontend-${options.frontendDeploy}`;
  const addonDir = join(TEMPLATES_DIR, 'addons', addonKey);
  mergeInto(addonDir, appTargetDir, { projectName: options.projectName, scope: options.scope });
}
