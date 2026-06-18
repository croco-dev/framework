import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const apiIndexPath = fileURLToPath(new URL("../src/content/docs/api/README.md", import.meta.url));
const policyExecutionPlanPath = fileURLToPath(
  new URL(
    "../src/content/docs/api/framework-context/src/functions/getPolicyExecutionPlan.md",
    import.meta.url,
  ),
);
const replacement = "API modules are available from the **API Reference** sidebar.";
const policyExecutionPlanLink =
  "[`PolicyExecutionPlan`](/api/framework-context/src/type-aliases/policyexecutionplan/)";
const policyExecutionPlanResult = `${policyExecutionPlanLink} \\| \`undefined\``;

export async function sanitizeTypeDocIndex() {
  await sanitizeApiIndex();
  await sanitizePolicyExecutionPlan();
}

async function sanitizeApiIndex() {
  const content = await readFile(apiIndexPath, "utf8");
  const sanitized = content.replace(
    /## Modules\n\n(?:- \[[^\n]+\]\([^\n]+\/readme\/\)\n?)+/u,
    replacement,
  );

  if (sanitized !== content) {
    await writeFile(apiIndexPath, sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`);
  }
}

async function sanitizePolicyExecutionPlan() {
  const content = await readFile(policyExecutionPlanPath, "utf8");
  const sanitized = content
    .replace(
      `> **getPolicyExecutionPlan**(\`table\`, \`target\`, \`capabilities\`): ${policyExecutionPlanLink}\n`,
      `> **getPolicyExecutionPlan**(\`table\`, \`target\`, \`capabilities\`): ${policyExecutionPlanResult}\n`,
    )
    .replace(
      `## Returns\n\n${policyExecutionPlanLink}\n`,
      `## Returns\n\n${policyExecutionPlanResult}\n`,
    );

  if (sanitized !== content) {
    await writeFile(
      policyExecutionPlanPath,
      sanitized.endsWith("\n") ? sanitized : `${sanitized}\n`,
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await sanitizeTypeDocIndex();
}
