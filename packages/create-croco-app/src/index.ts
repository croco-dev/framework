import { createProgram } from './cli.js';

const program = createProgram();
program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
