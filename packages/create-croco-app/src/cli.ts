import { Command } from 'commander';
import type { GeneratorOptions } from './types.js';

export function createProgram(): Command {
  const program = new Command();

  program
    .name('create-croco-app')
    .description('Create a new Croco application')
    .version('0.1.0')
    .argument('[directory]', 'Target directory')
    .option('--preset <preset>', 'Project preset (blank|ddd-api|ddd-fullstack)')
    .option('--scope <scope>', 'Package scope (e.g. @myorg)')
    .option('--api <api>', 'API type (graphql|trpc)')
    .option('--api-hosting <hosting>', 'API hosting (standalone|nextjs)')
    .option('--no-agent-rules', 'Skip agent rules')
    .option('--no-install', 'Skip dependency installation')
    .option('--no-git', 'Skip git initialization')
    .action(async (directory: string | undefined, options: Partial<GeneratorOptions>) => {
      // TODO: implement in Task 21 (CLI integration)
      console.log('create-croco-app', { directory, options });
    });

  return program;
}
