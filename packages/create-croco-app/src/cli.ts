import { intro, outro } from '@clack/prompts';
import { Command } from 'commander';
import { generate } from './generator.js';
import { runPrompts } from './prompts.js';
import type { GeneratorOptions } from './types.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('create-croco-app')
    .description('Create a new Croco application')
    .version('0.1.0')
    .argument('[directory]', 'Target directory')
    .option('--preset <preset>', 'Project preset (blank|ddd-api|ddd-fullstack|ddd-vike-fullstack)')
    .option('--scope <scope>', 'Package scope (e.g. @myorg)')
    .option('--api <api>', 'API type (graphql|trpc)')
    .option('--api-hosting <hosting>', 'API hosting (standalone|nextjs)')
    .option('--web-apps <apps>', 'Comma-separated web app names')
    .option('--backend-deploy <deploy>', 'Backend deploy (docker|lambda)')
    .option('--frontend-deploy <deploy>', 'Frontend deploy (opennext|vercel|docker|cloudflare-vike)')
    .option('--db <dbs>', 'Comma-separated DB types (postgres,mongodb,redis)')
    .option('--no-agent-rules', 'Skip agent rules')
    .option('--no-install', 'Skip dependency installation')
    .option('--no-git', 'Skip git initialization')
    .action(async (directory: string | undefined, rawOptions: Record<string, string | boolean>) => {
      try {
        intro('create-croco-app');

        // Parse CLI options to Partial<GeneratorOptions>
        const cliOptions: Partial<GeneratorOptions> = {};

        if (directory) cliOptions.projectName = directory.split('/').at(-1) ?? directory;
        if (rawOptions.preset) cliOptions.preset = rawOptions.preset as GeneratorOptions['preset'];
        if (rawOptions.scope) cliOptions.scope = rawOptions.scope as string;
        if (rawOptions.api) cliOptions.api = rawOptions.api as GeneratorOptions['api'];
        if (rawOptions.apiHosting) cliOptions.apiHosting = rawOptions.apiHosting as GeneratorOptions['apiHosting'];
        if (rawOptions.webApps)
          cliOptions.webApps = (rawOptions.webApps as string)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean);
        if (rawOptions.backendDeploy)
          cliOptions.backendDeploy = rawOptions.backendDeploy as GeneratorOptions['backendDeploy'];
        if (rawOptions.frontendDeploy)
          cliOptions.frontendDeploy = rawOptions.frontendDeploy as GeneratorOptions['frontendDeploy'];
        if (rawOptions.db)
          cliOptions.db = (rawOptions.db as string)
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean) as GeneratorOptions['db'];
        cliOptions.db = (rawOptions.db as string).split(',').map((s) => s.trim()) as GeneratorOptions['db'];
        if (rawOptions.agentRules === false) cliOptions.agentRules = false;
        if (rawOptions.install === false) cliOptions.installDeps = false;
        if (rawOptions.git === false) cliOptions.initGit = false;

        // Determine if non-interactive (all required options provided)
        const isNonInteractive = !!cliOptions.preset && !!cliOptions.scope && !!cliOptions.projectName;

        let options: GeneratorOptions;

        if (isNonInteractive) {
          // Non-interactive: fill defaults for missing optional fields
          options = {
            projectName: cliOptions.projectName ?? '',
            scope: cliOptions.scope ?? '',
            preset: cliOptions.preset ?? 'blank',
            webApps: cliOptions.webApps ?? [],
            api: cliOptions.api,
            apiHosting: cliOptions.apiHosting ?? 'standalone',
            backendDeploy: cliOptions.backendDeploy,
            frontendDeploy: cliOptions.frontendDeploy,
            db: cliOptions.db ?? [],
            agentRules: cliOptions.agentRules ?? true,
            installDeps: cliOptions.installDeps ?? true,
            initGit: cliOptions.initGit ?? true,
          };
        } else {
          // Interactive mode
          options = await runPrompts(cliOptions);
        }

        const targetDir = directory ?? options.projectName;
        await generate(targetDir, options);

        outro(`Project created in ${targetDir} 🎉`);
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`\nError: ${message}`);
        process.exit(1);
      }
    });

  return program;
}
