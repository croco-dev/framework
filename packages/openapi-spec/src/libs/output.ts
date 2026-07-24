import { readFile } from "node:fs/promises";

export type OpenAPIOutputDrift = "changed" | "missing";

export function serializeOpenAPIDocument(document: unknown): string {
  return JSON.stringify(document, null, 2);
}

export async function checkOpenAPIOutput(
  outFile: string,
  expectedContent: string,
): Promise<OpenAPIOutputDrift | null> {
  let actualContent: string;

  try {
    actualContent = await readFile(outFile, "utf8");
  } catch (error) {
    if (isErrorWithCode(error, "ENOENT")) {
      return "missing";
    }

    throw error;
  }

  return normalizeGeneratedContent(actualContent) === normalizeGeneratedContent(expectedContent)
    ? null
    : "changed";
}

function normalizeGeneratedContent(content: string): string {
  return content.replace(/\r\n?/g, "\n");
}

function isErrorWithCode(error: unknown, code: string): boolean {
  return error instanceof Error && "code" in error && error.code === code;
}
