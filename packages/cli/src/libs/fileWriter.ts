import { writeFile, readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname } from "node:path";

export type WriteStatus = "created" | "skipped-dry-run" | "overwritten" | "exists-no-overwrite";

export interface WriteOptions {
  dryRun?: boolean;
  overwrite?: boolean;
}

export interface WriteResult {
  status: WriteStatus;
  path: string;
  diff?: string;
}

export async function write(
  targetPath: string,
  content: string,
  options: WriteOptions = {},
): Promise<WriteResult> {
  const { dryRun = false, overwrite = false } = options;
  const exists = existsSync(targetPath);

  if (dryRun) {
    const diff = exists
      ? await generateDiff(targetPath, content)
      : `+${content.split("\n").length} lines`;
    return { status: "skipped-dry-run", path: targetPath, diff };
  }

  if (exists && !overwrite) {
    return { status: "exists-no-overwrite", path: targetPath };
  }

  await mkdir(dirname(targetPath), { recursive: true });
  const diff = exists ? await generateDiff(targetPath, content) : undefined;
  await writeFile(targetPath, content, "utf-8");
  return { status: exists ? "overwritten" : "created", path: targetPath, diff };
}

async function generateDiff(filePath: string, newContent: string): Promise<string> {
  const existing = existsSync(filePath);
  if (!existing) {
    return `+${newContent.split("\n").length} lines`;
  }
  const oldContent = await readFile(filePath, "utf-8");
  const oldLines = oldContent.split("\n");
  const newLines = newContent.split("\n");
  const diffLines: string[] = [];
  const maxLines = Math.max(oldLines.length, newLines.length);
  for (let i = 0; i < maxLines; i++) {
    const oldLine = oldLines[i] ?? null;
    const newLine = newLines[i] ?? null;
    if (oldLine === newLine) {
      diffLines.push(`  ${oldLine}`);
    } else {
      if (oldLine !== null) diffLines.push(`- ${oldLine}`);
      if (newLine !== null) diffLines.push(`+ ${newLine}`);
    }
  }
  return diffLines.join("\n");
}
