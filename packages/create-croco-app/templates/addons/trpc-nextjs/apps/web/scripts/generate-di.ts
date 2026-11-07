import { generateDi } from "./di.mjs";

generateDi().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
